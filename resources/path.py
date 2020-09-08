import numpy as np
from flask import request
from flask_restful import Resource
from sklearn.decomposition import PCA
from sklearn.svm import SVC
from sklearn.manifold import Isomap
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import normalize
import networkx as nx
from itertools import chain

from .utils import knn_by_label


def intersection_distance_creator(k):
    def _intersection_distance(l1, l2):
        return 1 - len(set(l1).intersection(set(l2))) / k

    return _intersection_distance


class Path(Resource):

    def __init__(self, json_data, Gs,
                 correct_predict_labels_,
                 correct_predict_idx_,
                 smoothed_knn):
        self.json_data = json_data
        self.Gs = Gs
        self.correct_predict_labels_ = correct_predict_labels_
        self.correct_predict_idx_ = correct_predict_idx_
        self.smoothed_knn = smoothed_knn

    def post(self):
        req_all = request.get_json(force=True)

        json_data = self.json_data
        correct_predict_labels_ = self.correct_predict_labels_
        correct_predict_idx_ = self.correct_predict_idx_
        smoothed_knn = self.smoothed_knn

        local_models = json_data['localModels']

        total_seeds = sorted(list(set(
            chain.from_iterable([l['target'] for l in local_models])
        )))
        seed_vector = np.array(json_data['dataVectors'])[total_seeds]

        seed_knn = NearestNeighbors(n_neighbors=5).fit(seed_vector)
        adjacency = seed_knn.kneighbors_graph(mode='distance')
        seed_graph = nx.from_scipy_sparse_matrix(adjacency, edge_attribute='weight')
        seed_graph = nx.relabel_nodes(seed_graph, dict(enumerate(total_seeds)))

        paths = []

        for req in req_all:

            source_local_svm = req['sourceLocalSVM']
            target_local_svm = req['targetLocalSVM']
            target_source = local_models[source_local_svm]['target']
            target_target = local_models[target_local_svm]['target']
            source_target_path = None
            source_target_length = 10000000000

            for s in target_source:
                for t in target_target:
                    _s_length = nx.shortest_path_length(G=seed_graph, source=s, target=t, weight='weight')
                    if _s_length < source_target_length:
                        source_target_length = _s_length
                        source_target_path = nx.shortest_path(G=seed_graph, source=s, target=t, weight='weight')

            LOCAL_SVM_C = 1e3
            vectors = np.array(json_data['dataVectors'])
            labels = np.array(json_data['label'])
            label_items = np.array(json_data['labelItems'])
            TARGET_SVM_TARGET_LABEL = 100
            TARGET_SVM_NON_TARGET_LABEL = 200

            path_local_svms = []

            for target_i in source_target_path[1:-1]:
                _local_train_nums = {
                    labels[target_i]: (len(label_items) - 1) * 10,
                    'others': (len(label_items) - 1) * 10
                }

                target_vector = vectors[target_i]

                dists, knns, new_labels = knn_by_label(
                    smoothed_knn,
                    correct_predict_labels_,
                    target_vector,
                    _local_train_nums
                )

                knn_list = [correct_predict_idx_[i] for i in knns[0]]
                knn_vectors = vectors[knn_list]
                _target_label = labels[target_i]
                binarized_knn_labels = [
                    TARGET_SVM_TARGET_LABEL if labels[k] == _target_label else TARGET_SVM_NON_TARGET_LABEL
                    for k in knn_list]

                local_svm = SVC(C=LOCAL_SVM_C, kernel='linear').fit(knn_vectors, binarized_knn_labels)

                normal_vector = local_svm.coef_[0]
                pca = PCA(n_components=1)
                pca_1d_coords = pca.fit_transform(vectors[knn_list])

                Q, R = np.linalg.qr(
                    np.vstack(
                        (normal_vector, pca.components_[0])
                    ).T
                )

                sample_list = []
                w = local_svm.coef_[0]
                b = local_svm.intercept_[0]

                cnt = 0
                while cnt < 3:
                    range_min = np.min(knn_vectors, axis=0)
                    range_max = np.max(knn_vectors, axis=0)

                    sample = np.array([
                        np.random.uniform(_min, _max)
                        for _min, _max in zip(range_min, range_max)
                    ])

                    x_m = (-b - np.dot(sample[:-1], w[:-1])) / w[-1]

                    if range_min[-1] < x_m < range_max[-1]:
                        sample[-1] = x_m
                        sample_list.append(sample.tolist())
                        cnt += 1

                path_local_svms.append({
                    'target': [int(target_i)],
                    'target_label': [labels[target_i]],
                    'target_vector': list(target_vector),
                    'knns': knn_list,
                    'local_svm': local_svm,
                    'train_acc': local_svm.score(vectors[knn_list], binarized_knn_labels),
                    'initSideMatrix': Q,
                    'planeSamples': sample_list
                })

            if len(path_local_svms) == 0:
                paths.append(dictify_localsvm(path_local_svms))
                continue

            ONLY_MERGE_SAME_CLASS = True
            local_svm_merge_list = []
            local_svm_merged_mask = [False] * len(path_local_svms)

            local_svm_knn_lists = [t['knns'] for t in path_local_svms]
            _intersection_distance_metric = intersection_distance_creator(len(local_svm_knn_lists[0]))

            local_svm_knn = NearestNeighbors(n_neighbors=len(path_local_svms) - 1, radius=1.0,
                                             metric=_intersection_distance_metric)
            local_svm_knn.fit(local_svm_knn_lists)

            for local_svm_i, local_svm in enumerate(path_local_svms):
                if local_svm_merged_mask[local_svm_i]:
                    continue

                nearby_local_svms_dists, nearby_local_svms_list = local_svm_knn.kneighbors([local_svm['knns']])

                nearby_local_svms_dists = nearby_local_svms_dists[0]
                nearby_local_svms_list = nearby_local_svms_list[0]

                for j, d in enumerate(nearby_local_svms_dists):
                    if d >= 1.0:
                        nearby_local_svms_list = nearby_local_svms_list[:j]
                        break

                temp_merge_candidates = [local_svm_i]

                for nearby_svm_i in nearby_local_svms_list:
                    if local_svm_merged_mask[nearby_svm_i] or nearby_svm_i == local_svm_i:
                        continue

                    nearby_svm = path_local_svms[nearby_svm_i]
                    if ONLY_MERGE_SAME_CLASS:
                        if nearby_svm['target_label'] != local_svm['target_label']:
                            continue

                    merge_test_train = []

                    for _lsvm_i in temp_merge_candidates:
                        _lsvm = path_local_svms[_lsvm_i]
                        merge_test_train += _lsvm['knns']

                    merge_test_train += path_local_svms[nearby_svm_i]['knns']

                    merge_train_vectors = vectors[merge_test_train]
                    merge_train_labels = labels[merge_test_train]

                    self_test_svm = SVC(C=LOCAL_SVM_C, kernel='linear')
                    self_test_svm.fit(merge_train_vectors, merge_train_labels)
                    self_test_score = self_test_svm.score(merge_train_vectors, merge_train_labels)

                    if self_test_score >= 0.9:
                        temp_merge_candidates.append(nearby_svm_i)

                local_svm_merge_list.append(temp_merge_candidates)

                for i in temp_merge_candidates:
                    local_svm_merged_mask[i] = True

            new_target_predict_local_svms = []

            for merges in local_svm_merge_list:

                new_target = []
                new_target_vector = []
                new_knns = []

                for t in merges:
                    target_local = path_local_svms[t]
                    new_target.append(target_local['target'])
                    new_target_vector.append(target_local['target_vector'])
                    new_knns += target_local['knns']

                knn_vectors = vectors[new_knns]

                flatten = lambda l: [item for sublist in l for item in sublist]
                new_target = flatten(new_target)

                _target_label = labels[new_target[0]]
                binarized_knn_labels = [
                    TARGET_SVM_TARGET_LABEL if labels[k] == _target_label else TARGET_SVM_NON_TARGET_LABEL
                    for k in new_knns]

                internal_pairwise_dists = Isomap(n_components=2).fit(knn_vectors).dist_matrix_

                local_svm = SVC(C=LOCAL_SVM_C, kernel='linear').fit(knn_vectors, binarized_knn_labels)

                normal_vector = local_svm.coef_[0]
                pca = PCA(n_components=1)
                pca_1d_coords = pca.fit_transform(knn_vectors)

                Q, R = np.linalg.qr(
                    np.vstack(
                        (normal_vector, pca.components_[0])
                    ).T
                )

                sample_list = []
                w = local_svm.coef_[0]
                b = local_svm.intercept_[0]

                cnt = 0
                while cnt < 3:
                    range_min = np.min(knn_vectors, axis=0)
                    range_max = np.max(knn_vectors, axis=0)

                    sample = np.array([
                        np.random.uniform(_min, _max)
                        for _min, _max in zip(range_min, range_max)
                    ])

                    x_m = (-b - np.dot(sample[:-1], w[:-1])) / w[-1]

                    if range_min[-1] < x_m < range_max[-1]:
                        sample[-1] = x_m
                        sample_list.append(sample.tolist())
                        cnt += 1

                new_target_predict = {
                    'target': new_target,
                    'target_label': labels[new_target],
                    'target_vector': new_target_vector,
                    'knns': new_knns,
                    'knns_size': np.max(internal_pairwise_dists),
                    'local_svm': local_svm,
                    'train_acc': local_svm.score(vectors[new_knns], binarized_knn_labels),
                    'target_centroid': np.mean(vectors[new_target], axis=0),
                    'all_centroid': np.mean(vectors[new_knns], axis=0),
                    'coverage': [],
                    'initSideMatrix': Q,
                    'planeSamples': sample_list
                }

                new_target_predict_local_svms.append(new_target_predict)

            paths.append(dictify_localsvm(new_target_predict_local_svms))

        return paths


def dictify_localsvm(path_local_svms):
    return [{
        'target': p['target'],
        'targetLabel': [int(i) for i in p['target_label']],
        'knns': [int(i) for i in p['knns']],
        'localSVM': {
            'C': p['local_svm'].C,
            'support_': p['local_svm'].support_.tolist(),
            'coef': normalize(p['local_svm'].coef_).tolist(),
            'intercept': p['local_svm'].intercept_.tolist()
        },
        'train_acc': p['train_acc'],
        'initSideMatrix': p['initSideMatrix'].tolist(),
        'planeSamples': p['planeSamples']
    }
        for p in path_local_svms
    ]

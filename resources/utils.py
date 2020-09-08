import networkx as nx
import numpy as np
import json


def compute_relation_graph(json_data):
    local_models = json_data['localModels']

    Gs = {}
    Ps = {}

    for i in range(5, 6):

        G = nx.Graph()

        for edges in json_data['localModelKNNGraph']:
            for e in edges[0:i]:
                G.add_edge(e['source'], e['target'], weight=e['value'])

        Gs[i] = G

        short_path = nx.shortest_path(G, weight='weight')

        non_connected_count = 0

        for source_node, v1 in short_path.items():
            for target_node, v2 in v1.items():
                if len(v2) == 1:
                    continue

                chain_list = []

                for n1, n2 in zip(v2[0: -1], v2[1:]):
                    chain_list.append(n1)

                    connect_set = set(
                        local_models[n1]['knns']
                    ).intersection(local_models[n2]['knns'])

                    if len(connect_set) == 0:
                        non_connected_count += 1
                        connect_set = None

                    chain_list.append(connect_set)
                    chain_list.append(n2)

                v1[target_node] = chain_list

        Ps[i] = short_path

    return Gs, Ps


def knn_by_label(nbrs, labels, target, requirement):
    target = np.array(target)

    if target.ndim == 1:
        target = target.reshape(1, -1)

    distances, target_knn = nbrs.kneighbors(target, nbrs.n_neighbors)

    knn_list_ret = []
    distance_list_ret = []
    label_list_ret = []

    for t, knn_list, dist in zip(target, target_knn, distances):

        filtered_knn_list = []
        filtered_dist_list = []
        filtered_label_list = []
        new_req = requirement.copy()

        for k, d in zip(knn_list, dist):
            target_l = labels[k]

            if target_l in new_req and new_req[target_l] > 0:
                filtered_knn_list.append(k)
                filtered_dist_list.append(d)
                filtered_label_list.append(target_l)
                new_req[labels[k]] -= 2
            elif 'others' in new_req and target_l not in new_req:
                if new_req['others'] > 0:
                    filtered_knn_list.append(k)
                    filtered_dist_list.append(d)
                    filtered_label_list.append(target_l)
                    new_req['others'] -= 2

            if all(x == 0 for x in new_req.values()):
                break

        if not all(x == 0 for x in new_req.values()):
            raise ValueError('The kNN cannot fulfill the requirement. Consider decrease the number of required items.')

        knn_list_ret.append(filtered_knn_list)
        distance_list_ret.append(filtered_dist_list)
        label_list_ret.append(filtered_label_list)

    return (
        np.array(distance_list_ret, dtype=float),
        np.array(knn_list_ret, dtype=int),
        np.array(label_list_ret, dtype=int)
    )


class NumpyEncoder(json.JSONEncoder):
    """ Special json encoder for numpy types """

    def default(self, obj):
        if isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
                            np.int16, np.int32, np.int64, np.uint8,
                            np.uint16, np.uint32, np.uint64)):
            return int(obj)
        elif isinstance(obj, (np.float_, np.float16, np.float32,
                              np.float64)):
            return float(obj)
        elif isinstance(obj, (np.ndarray,)):
            return obj.tolist()
        return json.JSONEncoder.default(self, obj)


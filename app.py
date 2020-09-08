#!/usr/bin/python3

import numpy as np
from sklearn.externals import joblib
from flask import Flask
from flask_restful import Api
from flask_cors import CORS
import json
from resources.data import Data
from resources.path import Path
from resources.utils import compute_relation_graph
import os


base_data_path = 'data/samples/shuttle/'

data_path = os.path.join(base_data_path, 'data.json')
model_file_names = {
    'correct_predict_labels_': os.path.join(base_data_path, 'correct_predict_labels.npy'),
    'correct_predict_idx_': os.path.join(base_data_path, 'correct_predict_idx.npy'),
    'smoothed_knn': os.path.join(base_data_path, 'smoothed_knn.joblib')
}

correct_predict_labels_ = np.load(model_file_names['correct_predict_labels_'])
correct_predict_idx_ = np.load(model_file_names['correct_predict_idx_'])
smoothed_knn = joblib.load(model_file_names['smoothed_knn'])

with open(data_path, 'r') as json_fin:
    json_data = json.load(json_fin)

Gs, Ps = compute_relation_graph(json_data)

"""
Flask starts here
"""

app = Flask(__name__)
api = Api(app)

# CORS for development purpose only
CORS(app, resources={r"/api/*": {"origins": "*"}})

api.add_resource(Data,
                 '/api/data',
                 resource_class_args=(json_data,))
api.add_resource(Path,
                 '/api/path',
                 resource_class_args=(
                     json_data,
                     Gs[5],
                     correct_predict_labels_,
                     correct_predict_idx_,
                     smoothed_knn
                 ))

if __name__ == '__main__':
    port = int(5000)
    app.run(host='127.0.0.1', port=port)

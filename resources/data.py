from flask_restful import Resource, Api, abort


class Data(Resource):

    def __init__(self, data):
        self.data = data

    def get(self):
        return self.data

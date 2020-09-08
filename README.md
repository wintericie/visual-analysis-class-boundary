## Visual Analysis of Class Separations with Locally Linear Segments

[Paper Link](http://vader.lab.asu.edu/docs/publications/pdf/2020/llp.pdf)

Abstract: High-dimensional labeled data widely exists in many real-world applications such as classification and clustering. One maintask in analyzing such datasets is to explore class separations and class boundaries derived from machine learning models.Dimension reduction techniques are commonly applied to support analysts in exploring the underlying decision boundary structures bydepicting a low-dimensional representation of the data distributions from multiple classes. However, such projection-based analysesare limited due to their lack of ability to show separations in complex non-linear decision boundary structures and can suffer from heavydistortion and low interpretability. To overcome these issues of separability and interpretability, we propose a visual analysis approachthat utilizes the power of explainability from linear projections to support analysts when exploring non-linear separation structures. Ourapproach is to extract a set of locally linear segments that approximate the original non-linear separations. Unlike traditionalprojection-based analysis where the data instances are mapped to a single scatterplot, our approach supports the exploration ofcomplex class separations through multiple local projection results. We conduct case studies on two labeled datasets to demonstratethe effectiveness of our approach.


### Installation
The system consists of two parts: the backend server, and the frontend web interface.

#### Prerequisites
Python 3.7+

Node 6.4+

yarn 1.22.* (version 2+ not tested)

Google Chrome Browser (Firefox or other modern browsers should work as well)

#### Setup the Backend
Install the dependencies for the Python backend:
```shell script
$ pip install -r requirements.txt
```

Start the server:
```shell script
$ python3.7 app.py
```
The server runs at http://localhost:5000. Please keep it running while using the frontend interface.

#### Setup the Frontend

Install yarn:
```shell script
$ npm -g install yarn
```

Install the dependencies with yarn:
```shell script
$ cd frontend
$ yarn
```

Start the frontend:
```shell script
$ yarn start
```

It starts a node development server at http://localhost:3000 by default. Please access it in a web browser to view the interface.

Note: the proxy setting in ```frontend/package.json``` is enabled to redirect the requests to the Python backend server, which is http://localhost:5000 by default.

### Replicability
Please refer to the documents in the ```replicate``` folder for more details.
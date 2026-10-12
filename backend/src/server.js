import express from 'express';
import { MongoClient, ServerApiVersion } from 'mongodb';

const app = express();

app.use(express.json());

app.get('/api/db', async (req, res) => {
    const { name } = req.params

    const uri = 'mongodb://127.0.0.1:27017';

    const client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });

    await client.connect();

    const db = client.db('hdb-db');
});

app.get('/hello', function(req, res) {
    res.send('Get Hello ' + req.body.name);
});

app.get('/hello/:name', function(req, res) {
    res.send('Get Hello ' + req.params.name);
});

app.post('/hello', function(req, res){
    res.send('Post Hello');
});

app.listen(8000, function() {
    console.log("Server is listening on port 8000");
});
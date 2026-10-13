import express from 'express';
import { fileURLToPath } from 'url';
import { MongoClient, ServerApiVersion } from 'mongodb';
import chatbotRouter from './chatbot/router.js';

// Load secrets such as ANTHROPIC_API_KEY from backend/.env if it exists.
try {
    process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
    // no .env file; rely on the real environment
}

const app = express();

app.use(express.json());

app.use('/chatbot', chatbotRouter);

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
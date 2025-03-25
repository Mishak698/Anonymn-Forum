const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;


const db = new sqlite3.Database('./db/database.sqlite', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            parent_id INTEGER DEFAULT NULL,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
        )`);
    }
});


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));



app.get('/api/posts', (req, res) => {
    const sortBy = req.query.sort || 'newest';
    let orderBy = 'created_at DESC';
    
    if (sortBy === 'comments') {
        orderBy = 'comment_count DESC';
    }
    
    const query = `
        SELECT p.*, COUNT(c.id) as comment_count
        FROM posts p
        LEFT JOIN comments c ON p.id = c.post_id AND c.parent_id IS NULL
        GROUP BY p.id
        ORDER BY ${orderBy}
    `;
    
    db.all(query, [], (err, posts) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(posts);
    });
});


app.post('/api/posts', (req, res) => {
    const { title, content } = req.body;
    db.run('INSERT INTO posts (title, content) VALUES (?, ?)', [title, content], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID });
    });
});


app.get('/api/posts/:id', (req, res) => {
    const postId = req.params.id;
    

    db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }
        
        
        db.all(`
            WITH RECURSIVE comment_tree(id, post_id, content, created_at, parent_id, depth) AS (
                SELECT id, post_id, content, created_at, parent_id, 0
                FROM comments
                WHERE post_id = ? AND parent_id IS NULL
                
                UNION ALL
                
                SELECT c.id, c.post_id, c.content, c.created_at, c.parent_id, ct.depth + 1
                FROM comments c
                JOIN comment_tree ct ON c.parent_id = ct.id
            )
            SELECT * FROM comment_tree
            ORDER BY CASE WHEN parent_id IS NULL THEN id ELSE parent_id END, created_at
        `, [postId], (err, comments) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            
            const commentMap = {};
            const rootComments = [];
            
            comments.forEach(comment => {
                comment.replies = [];
                commentMap[comment.id] = comment;
                
                if (comment.parent_id) {
                    if (commentMap[comment.parent_id]) {
                        commentMap[comment.parent_id].replies.push(comment);
                    }
                } else {
                    rootComments.push(comment);
                }
            });
            
            res.json({
                ...post,
                comments: rootComments
            });
        });
    });
});


app.post('/api/posts/:id/comments', (req, res) => {
    const postId = req.params.id;
    const { content, parent_id } = req.body;
    
    db.run(
        'INSERT INTO comments (post_id, content, parent_id) VALUES (?, ?, ?)',
        [postId, content, parent_id || null],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
          
            db.get('SELECT * FROM comments WHERE id = ?', [this.lastID], (err, comment) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(comment);
            });
        }
    );
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
document.addEventListener('DOMContentLoaded', function() {
    
    const postForm = document.getElementById('post-form');
    const postsContainer = document.getElementById('posts-container');
    const modal = document.getElementById('post-detail-modal');
    const closeBtn = document.querySelector('.close');
    const postDetail = document.getElementById('post-detail');
    const commentsContainer = document.getElementById('comments-container');
    const commentForm = document.getElementById('comment-form');
    const commentContent = document.getElementById('comment-content');
    const commentParentId = document.getElementById('comment-parent-id');
    const sortNewestBtn = document.getElementById('sort-newest');
    const sortCommentsBtn = document.getElementById('sort-comments');
    
    let currentPostId = null;
    

    postForm.addEventListener('submit', createPost);
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
    commentForm.addEventListener('submit', addComment);
    sortNewestBtn.addEventListener('click', () => loadPosts('newest'));
    sortCommentsBtn.addEventListener('click', () => loadPosts('comments'));
    

    loadPosts();
    

    function loadPosts(sortBy = 'newest') {
        fetch(`/api/posts?sort=${sortBy}`)
            .then(response => response.json())
            .then(posts => {
                postsContainer.innerHTML = '';
                if (posts.length === 0) {
                    postsContainer.innerHTML = '<p>No posts yet. Be the first to create one!</p>';
                    return;
                }
                
                posts.forEach(post => {
                    const postCard = document.createElement('div');
                    postCard.className = 'post-card';
                    postCard.innerHTML = `
                        <h3>${post.title}</h3>
                        <p>${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}</p>
                        <div class="meta">
                            ${new Date(post.created_at).toLocaleString()} • 
                            ${post.comment_count || 0} comments
                        </div>
                    `;
                    postCard.addEventListener('click', () => viewPostDetail(post.id));
                    postsContainer.appendChild(postCard);
                });
            })
            .catch(error => console.error('Error loading posts:', error));
    }
    
    function createPost(e) {
        e.preventDefault();
        const title = document.getElementById('post-title').value;
        const content = document.getElementById('post-content').value;
        
        fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, content })
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById('post-form').reset();
            loadPosts();
        })
        .catch(error => console.error('Error creating post:', error));
    }
    
    function viewPostDetail(postId) {
        currentPostId = postId;
        fetch(`/api/posts/${postId}`)
            .then(response => response.json())
            .then(post => {
                postDetail.innerHTML = `
                    <h2>${post.title}</h2>
                    <p>${post.content}</p>
                    <div class="meta">
                        Posted on ${new Date(post.created_at).toLocaleString()}
                    </div>
                `;
                
                renderComments(post.comments);
                modal.style.display = 'block';
            })
            .catch(error => console.error('Error loading post:', error));
    }
    
    function renderComments(comments, depth = 0) {
        commentsContainer.innerHTML = '';
        
        if (!comments || comments.length === 0) {
            commentsContainer.innerHTML = '<p>No comments yet. Be the first to comment!</p>';
            return;
        }
        
        comments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = depth > 0 ? 'reply' : 'comment';
            commentElement.style.marginLeft = `${depth * 20}px`;
            commentElement.innerHTML = `
                <div class="content">${comment.content}</div>
                <div class="meta">
                    ${new Date(comment.created_at).toLocaleString()}
                    <button class="reply-btn" data-comment-id="${comment.id}">Reply</button>
                </div>
            `;
            
            const repliesContainer = document.createElement('div');
            repliesContainer.className = 'replies';
            if (comment.replies && comment.replies.length > 0) {
                renderNestedComments(comment.replies, repliesContainer, depth + 1);
            }
            
            commentElement.appendChild(repliesContainer);
            commentsContainer.appendChild(commentElement);
        });
        
      
        document.querySelectorAll('.reply-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const commentId = this.getAttribute('data-comment-id');
                commentParentId.value = commentId;
                commentContent.focus();
            });
        });
    }
    
    function renderNestedComments(comments, container, depth) {
        comments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'reply';
            commentElement.style.marginLeft = `${depth * 20}px`;
            commentElement.innerHTML = `
                <div class="content">${comment.content}</div>
                <div class="meta">
                    ${new Date(comment.created_at).toLocaleString()}
                    <button class="reply-btn" data-comment-id="${comment.id}">Reply</button>
                </div>
            `;
            
            const repliesContainer = document.createElement('div');
            repliesContainer.className = 'replies';
            if (comment.replies && comment.replies.length > 0) {
                renderNestedComments(comment.replies, repliesContainer, depth + 1);
            }
            
            commentElement.appendChild(repliesContainer);
            container.appendChild(commentElement);
        });
    }
    
    function addComment(e) {
        e.preventDefault();
        const content = commentContent.value;
        const parentId = commentParentId.value || null;
        
        fetch(`/api/posts/${currentPostId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content, parent_id: parentId })
        })
        .then(response => response.json())
        .then(() => {
            commentForm.reset();
            commentParentId.value = '';
            viewPostDetail(currentPostId);
        })
        .catch(error => console.error('Error adding comment:', error));
    }
});
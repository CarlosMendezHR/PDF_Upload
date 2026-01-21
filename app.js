// Load saved token from localStorage
window.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('github_token');
    if (savedToken) {
        document.getElementById('token').value = savedToken;
    }
});

// Save token to localStorage when changed
document.getElementById('token').addEventListener('change', (e) => {
    if (e.target.value) {
        localStorage.setItem('github_token', e.target.value);
    }
});

// Form submission handler
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const owner = document.getElementById('owner').value.trim();
    const repo = document.getElementById('repo').value.trim();
    const branch = document.getElementById('branch').value.trim() || 'main';
    const token = document.getElementById('token').value.trim();
    const fileInput = document.getElementById('pdfFile');
    const file = fileInput.files[0];
    
    // Validate inputs
    if (!owner || !repo || !branch || !token || !file) {
        showStatus('Please fill in all required fields.', 'error');
        return;
    }
    
    // Validate file type
    if (file.type !== 'application/pdf') {
        showStatus('Only PDF files are allowed.', 'error');
        return;
    }
    
    // Validate file size (25MB = 25 * 1024 * 1024 bytes)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
        showStatus('File size exceeds 25MB limit.', 'error');
        return;
    }
    
    // Save token
    localStorage.setItem('github_token', token);
    
    // Hide previous result
    document.getElementById('result').classList.add('hidden');
    
    // Show uploading status
    showStatus('Uploading PDF...', 'info');
    document.getElementById('uploadBtn').disabled = true;
    
    try {
        const publicUrl = await uploadPDF(owner, repo, branch, token, file);
        showResult(publicUrl);
        showStatus('Upload successful!', 'success');
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        document.getElementById('uploadBtn').disabled = false;
    }
});

// Upload PDF to GitHub
async function uploadPDF(owner, repo, branch, token, file) {
    const maxRetries = 5;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            // Generate unique filename
            const uniquePath = generateUniquePath(file.name);
            
            // Read file as base64
            const base64Content = await readFileAsBase64(file);
            
            // Prepare API request
            const path = `uploads/${uniquePath}`;
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
            
            const message = `Upload PDF: ${file.name}`;
            
            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    content: base64Content,
                    branch: branch
                })
            });
            
            const data = await response.json();
            
            if (response.status === 201 || response.status === 200) {
                // Success - construct public URL
                const publicUrl = `https://${owner}.github.io/${repo}/${path}`;
                return publicUrl;
            } else if (response.status === 409) {
                // File exists, retry with new filename
                attempt++;
                if (attempt >= maxRetries) {
                    throw new Error('Failed to generate unique filename after 5 attempts. Please try again.');
                }
                // Continue loop to retry with new filename
                continue;
            } else {
                // Other error
                const errorMsg = data.message || `HTTP ${response.status}: ${response.statusText}`;
                throw new Error(errorMsg);
            }
        } catch (error) {
            if (error.message.includes('Failed to generate unique filename')) {
                throw error;
            }
            // Network or other errors
            throw new Error(`Upload failed: ${error.message}`);
        }
    }
}

// Generate unique file path: uploads/YYYY/MM/timestamp-random-sanitizedName.pdf
function generateUniquePath(originalName) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    
    // Sanitize original filename
    const sanitized = originalName
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    
    // Ensure it ends with .pdf
    const nameWithoutExt = sanitized.replace(/\.pdf$/i, '');
    const finalName = nameWithoutExt || 'upload';
    
    return `${year}/${month}/${timestamp}-${random}-${finalName}.pdf`;
}

// Read file as base64 (strip data URL prefix if present)
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            let base64 = reader.result;
            // Strip data URL prefix if present
            if (base64.includes(',')) {
                base64 = base64.split(',')[1];
            }
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Show status message
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.classList.remove('hidden');
}

// Show result with URL
function showResult(url) {
    const resultEl = document.getElementById('result');
    const urlEl = document.getElementById('resultUrl');
    
    urlEl.href = url;
    urlEl.textContent = url;
    
    resultEl.classList.remove('hidden');
}

// Copy to clipboard
document.getElementById('copyBtn').addEventListener('click', async () => {
    const url = document.getElementById('resultUrl').href;
    
    try {
        await navigator.clipboard.writeText(url);
        const copyBtn = document.getElementById('copyBtn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            const copyBtn = document.getElementById('copyBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        } catch (err) {
            alert('Failed to copy. Please copy manually.');
        }
        document.body.removeChild(textArea);
    }
});

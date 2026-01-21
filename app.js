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
    showStatus('Uploading PDF and creating redirect page...', 'info');
    document.getElementById('uploadBtn').disabled = true;
    
    try {
        const urls = await uploadPDF(owner, repo, branch, token, file);
        showResult(urls);
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
                // Success - construct public URLs
                const pdfUrl = `https://${owner}.github.io/${repo}/${path}`;
                
                // Create HTML redirect page for email providers
                const htmlPath = path.replace('.pdf', '.html');
                const fileName = path.split('/').pop();
                const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0; url=${fileName}">
    <meta name="robots" content="noindex">
    <title>PDF Document</title>
</head>
<body>
    <p>Loading PDF... <a href="${fileName}">Click here if not redirected</a></p>
    <script>window.location.href = "${fileName}";</script>
</body>
</html>`;
                
                // Upload HTML redirect file
                const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));
                const htmlApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${htmlPath}`;
                
                try {
                    const htmlResponse = await fetch(htmlApiUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `Add redirect page for ${file.name}`,
                            content: htmlBase64,
                            branch: branch
                        })
                    });
                    
                    if (htmlResponse.status === 201 || htmlResponse.status === 200) {
                        const htmlUrl = `https://${owner}.github.io/${repo}/${htmlPath}`;
                        return { htmlUrl, pdfUrl };
                    } else {
                        // If HTML upload fails, still return PDF URL
                        console.warn('HTML redirect page creation failed, using PDF URL only');
                        return { htmlUrl: pdfUrl, pdfUrl };
                    }
                } catch (htmlError) {
                    // If HTML upload fails, still return PDF URL
                    console.warn('Failed to create HTML redirect:', htmlError);
                    return { htmlUrl: pdfUrl, pdfUrl };
                }
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
function showResult(urls) {
    const resultEl = document.getElementById('result');
    const htmlUrl = urls.htmlUrl || urls;
    const pdfUrl = urls.pdfUrl || urls;
    
    // Update the result HTML to show both URLs
    resultEl.innerHTML = `
        <h2>Upload Successful!</h2>
        <p class="result-label">Public URL (for email providers):</p>
        <div class="url-container">
            <a id="resultUrl" href="${htmlUrl}" target="_blank" class="url-link">${htmlUrl}</a>
            <button id="copyBtn" class="btn-copy">Copy URL</button>
        </div>
        <p class="result-label" style="margin-top: 15px;">Direct PDF URL:</p>
        <div class="url-container">
            <a id="pdfUrl" href="${pdfUrl}" target="_blank" class="url-link" style="font-size: 12px;">${pdfUrl}</a>
            <button id="copyPdfBtn" class="btn-copy">Copy PDF URL</button>
        </div>
        <p class="note">Note: If you just enabled GitHub Pages, the first deploy may take ~1–2 minutes.</p>
    `;
    
    // Re-attach copy button event listeners
    document.getElementById('copyBtn').addEventListener('click', async () => {
        const url = document.getElementById('resultUrl').href;
        await copyToClipboard(url, 'copyBtn');
    });
    
    const copyPdfBtn = document.getElementById('copyPdfBtn');
    if (copyPdfBtn) {
        copyPdfBtn.addEventListener('click', async () => {
            const url = document.getElementById('pdfUrl').href;
            await copyToClipboard(url, 'copyPdfBtn');
        });
    }
    
    resultEl.classList.remove('hidden');
}

// Copy to clipboard helper function
async function copyToClipboard(text, buttonId) {
    try {
        await navigator.clipboard.writeText(text);
        const copyBtn = document.getElementById(buttonId);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            const copyBtn = document.getElementById(buttonId);
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
}

// Copy to clipboard event listeners are now attached dynamically in showResult()

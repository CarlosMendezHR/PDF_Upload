# GitHub PDF Uploader

A client-side web application that uploads PDFs directly to GitHub repositories and generates public GitHub Pages URLs for each upload.

## Features

- 📄 Upload PDFs directly to GitHub via REST API
- 🔗 Get instant public URLs ending in `.pdf`
- 🔒 Secure token storage in localStorage
- ✨ Unique filename generation (no overwrites)
- 📋 Copy-to-clipboard functionality
- 📱 Responsive design

## Setup Instructions

### 1. Make Repository Public

Your GitHub repository must be **public** for GitHub Pages to serve files:
- Go to your repository on GitHub
- Navigate to **Settings** → **General** → **Danger Zone**
- Click **Change visibility** → **Make public**

### 2. Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Choose your branch (e.g., `main`) and folder (usually `/ (root)`)
5. Click **Save**

### 3. Place Static Files in Repository Root

The web application files should be placed in the repository root:
- `index.html` (main form)
- `app.js` (upload logic)
- `style.css` (styling)

The PDFs will be automatically committed by the app to the `/uploads/` directory with a structure like:
```
uploads/
  YYYY/
    MM/
      timestamp-random-filename.pdf
```

### 4. Create GitHub Personal Access Token (PAT)

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Name your token (e.g., "PDF Uploader")
4. Select the `repo` scope (full control of private repositories)
5. Click **Generate token**
6. **Copy the token immediately** (you won't see it again)

⚠️ **Important**: Use a **classic PAT** with the `repo` scope. Fine-grained tokens may not work with this API endpoint.

### 5. Deploy and Use

1. Commit and push the static files (`index.html`, `app.js`, `style.css`) to your repository
2. Wait for GitHub Pages to deploy (usually 1-2 minutes)
3. Visit your GitHub Pages URL: `https://<owner>.github.io/<repo>/`
4. Fill in the form:
   - **GitHub Owner**: Your username or organization
   - **Repository Name**: The repository name
   - **Branch**: Usually `main` or `master`
   - **GitHub Personal Access Token**: Your PAT (saved in localStorage)
   - **PDF File**: Select a PDF (max 25MB)
5. Click **Upload PDF**
6. Copy the generated public URL!

## How It Works

1. **File Selection**: User selects a PDF file (validated for type and size)
2. **Unique Path Generation**: Creates a unique filename using:
   - Current year and month: `uploads/YYYY/MM/`
   - Timestamp and random string
   - Sanitized original filename
3. **Base64 Encoding**: Converts PDF to base64
4. **GitHub API Call**: Uses PUT endpoint to create/update file:
   ```
   PUT https://api.github.com/repos/{owner}/{repo}/contents/{path}
   ```
5. **Conflict Handling**: If file exists (409), generates new filename and retries (up to 5 times)
6. **Public URL**: Constructs GitHub Pages URL:
   ```
   https://{owner}.github.io/{repo}/uploads/YYYY/MM/timestamp-random-name.pdf
   ```

## Notes

- ⏱️ **First Deploy**: If you just enabled GitHub Pages, the first deployment may take 1-2 minutes
- 🔄 **Auto-retry**: The app automatically retries with new filenames if there's a conflict
- 💾 **Token Storage**: Your GitHub token is stored in browser localStorage (never sent anywhere else)
- 📦 **File Size**: Maximum 25MB per PDF (GitHub API limit)
- 🌐 **CORS**: Uses GitHub's REST API which supports CORS for authenticated requests

## Security Considerations

- The PAT is stored only in your browser's localStorage
- Never commit your PAT to the repository
- Consider using a token with minimal required scopes
- The token has full repository access - keep it secure

## Troubleshooting

**"Upload failed: Bad credentials"**
- Check that your PAT is correct and has `repo` scope
- Ensure you're using a classic token, not a fine-grained token

**"File not found" after upload**
- GitHub Pages may take 1-2 minutes to deploy
- Ensure the repository is public
- Check that Pages is enabled and deploying from the correct branch

**"Failed to generate unique filename"**
- Very rare - occurs if 5 consecutive filename collisions happen
- Try uploading again

**CORS errors**
- Ensure you're accessing the app via the GitHub Pages URL, not `file://`
- Check browser console for specific error messages

## License

MIT License - feel free to use and modify as needed.

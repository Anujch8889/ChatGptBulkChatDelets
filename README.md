# Bulk Delete Chats for ChatGPT - Chrome Extension

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-green?logo=google-chrome)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/Version-2.3.0-blue)](https://github.com/Anujch8889/ChatGptBulkChatDelets)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

> **🗑️ Delete ALL ChatGPT conversations at once! The #1 bulk delete extension for ChatGPT.**

## 🌟 Features

### ✅ Bulk Delete Selected Chats
- Add checkboxes to all chat conversations
- Select multiple chats with one click
- Delete or archive selected chats instantly

### ✅ Delete ALL Chats (Lifetime Delete)
- **Delete your ENTIRE chat history** with one click
- Works with ANY number of conversations (100, 1000, 10000+)
- Handles ChatGPT pagination automatically
- Double confirmation for safety

### ✅ Archive ALL Chats
- Archive your complete chat history
- Keep chats saved but hidden
- Restore anytime from ChatGPT settings

### ✅ Real-Time Progress
- Live progress bar during operations
- Shows percentage completion
- Success/failure count displayed

---

## 🔑 Keywords

`chatgpt bulk delete` `delete all chatgpt chats` `chatgpt clear history` `bulk delete chatgpt conversations` `chatgpt mass delete` `clear chatgpt chat history` `delete chatgpt history` `chatgpt conversation cleaner` `chatgpt chat manager` `openai chat delete` `gpt delete all chats` `chatgpt archive chats` `bulk archive chatgpt` `chatgpt cleanup tool` `chatgpt extension` `delete multiple chatgpt chats` `chatgpt history eraser` `clear all gpt conversations` `chatgpt bulk cleaner` `mass delete gpt chats`

---

## 📦 Installation

### From Chrome Web Store (Recommended)
1. Visit [Chrome Web Store](https://chrome.google.com/webstore) (link coming soon)
2. Click "Add to Chrome"
3. Done! Open ChatGPT and click the extension icon

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the extension folder
6. Done!

---

## 🚀 How to Use

### Delete Selected Chats
1. Open [ChatGPT](https://chatgpt.com)
2. Click the extension icon
3. Click **"Add Checkboxes"**
4. Select the chats you want to delete
5. Click **"Bulk Delete"** or **"Bulk Archive"**

### Delete ALL Chats (Complete History)
1. Open [ChatGPT](https://chatgpt.com)
2. Click the extension icon
3. Click **"Delete ALL Chats"** (red button)
4. Confirm by clicking OK
5. Type **DELETE** to confirm
6. Wait for completion (progress shown)
7. Page auto-refreshes when done!

### Archive ALL Chats
1. Same as above, but click **"Archive ALL Chats"**
2. Type **ARCHIVE** to confirm

---

## 🔒 Privacy & Security

- ✅ **No data collection** - We don't collect any personal information
- ✅ **No external servers** - All operations happen locally in your browser
- ✅ **No tracking** - Zero analytics or tracking code
- ✅ **Open source** - Full code available for review
- ✅ **Minimal permissions** - Only requests access to ChatGPT website

---

## 🛠️ Technical Details

- **Manifest Version**: 3 (Latest Chrome Extension standard)
- **API Used**: ChatGPT official backend API
- **Delete Method**: Sets `is_visible: false` via PATCH request
- **Archive Method**: Sets `is_archived: true` via PATCH request
- **Pagination**: Handles unlimited conversations automatically

---

## ❓ FAQ

### Q: Is this safe to use?
**A:** Yes! The extension only interacts with ChatGPT's official API endpoints. Your data never leaves the browser.

### Q: Will this delete my account?
**A:** No. This only deletes/archives chat conversations, not your OpenAI account.

### Q: How many chats can it delete?
**A:** Unlimited! The extension handles pagination automatically, so it works with any number of chats.

### Q: Why do some chats fail to delete?
**A:** Some chats may have special protection or already be deleted. The extension continues with remaining chats.

### Q: Does it work on the ChatGPT mobile app?
**A:** No. Chrome extensions only work in the Chrome browser.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not working | Refresh the ChatGPT page |
| "Access token" error | Log out and log back into ChatGPT |
| Progress stuck | Wait a few seconds, then try again |
| Some chats not deleted | These may already be archived/deleted |

---

## 📸 Screenshots

### Main Interface
- Modern dark theme UI
- One-click operations
- Real-time progress tracking

### Checkbox Selection
- Purple checkboxes on each chat
- Visual highlighting of selected chats
- Toggle all with one click

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Anuj Choudhary**

- GitHub: [@Anujch8889](https://github.com/Anujch8889)
- Instagram: [@_anuj.ch](https://instagram.com/_anuj.ch)

---

## ⭐ Support

If this extension helped you, please:
- ⭐ Star this repository
- 📝 Leave a review on Chrome Web Store
- 🔗 Share with friends who use ChatGPT

---

## 🔄 Changelog

### v2.3.0 (Latest)
- ✅ Real-time progress updates
- ✅ Fixed pagination for all chats
- ✅ Improved error handling
- ✅ Better status messages

### v2.2.0
- ✅ Added Lifetime Delete/Archive feature
- ✅ Double confirmation for safety
- ✅ Auto-refresh after completion

### v2.1.0
- ✅ API-based delete (more reliable)
- ✅ Modern dark theme UI
- ✅ Checkbox toggle functionality

### v1.0.0
- Initial release
- Basic bulk delete functionality

---

**Made with ❤️ for ChatGPT users worldwide**

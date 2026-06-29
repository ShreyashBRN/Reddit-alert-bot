const axios = require("axios");
const fs = require("fs");
const keywords = require("./keywords");
const subreddits = require("./subreddits");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SEEN_FILE = "seen.json";

let seen = [];
if (fs.existsSync(SEEN_FILE)) {
  seen = JSON.parse(fs.readFileSync(SEEN_FILE));
}

async function fetchPosts(subreddit) {
  const res = await axios.get(
    `https://www.reddit.com/r/${subreddit}/new.json?limit=25`,
    {
      headers: { "User-Agent": "freelance-alert-bot/1.0" }
    }
  );
  return res.data.data.children.map((p) => p.data);
}

function matchesKeyword(post) {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  return keywords.find((kw) => text.includes(kw.toLowerCase()));
}

async function sendTelegram(message) {
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: CHAT_ID,
    text: message,
    parse_mode: "Markdown"
  });
}

async function main() {
  const newSeen = [];

  for (const subreddit of subreddits) {
    try {
      const posts = await fetchPosts(subreddit);
      for (const post of posts) {
        if (seen.includes(post.id)) continue;
        newSeen.push(post.id);
        const matched = matchesKeyword(post);
        if (matched) {
          const message = `
🚨 *New Freelance Lead!*
📌 *Subreddit:* r/${post.subreddit}
📝 *Title:* ${post.title}
🔑 *Matched:* \`${matched}\`
🔗 [View Post](https://reddit.com${post.permalink})
          `;
          await sendTelegram(message);
        }
      }
    } catch (err) {
      console.error(`Error fetching r/${subreddit}:`, err.message);
    }
  }

  const updatedSeen = [...seen, ...newSeen].slice(-500);
  fs.writeFileSync(SEEN_FILE, JSON.stringify(updatedSeen));
}

main();
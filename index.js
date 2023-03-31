require("dotenv").config();

const { Client, IntentsBitField } = require("discord.js");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const Enmap = require("enmap");
const Parser = require("rss-parser");

const db = new Enmap({ name: "posts" });

const channelsSrednja = process.env.CHANNELS_SREDNJA.split(",");
const channelsOsnovna = process.env.CHANNELS_OSNOVNA.split(",");
const channelsDms = process.env.CHANNELS_DMS.split(",");

const client = new Client({
  intents: [IntentsBitField.Flags.Guilds],
});

async function getTakprogPosts(url) {
  const content = await fetch(url).then((r) => r.text());

  const $ = cheerio.load(content);

  const posts = $(".post-content")
    .toArray()
    .map((item) => {
      const text = cheerio
        .text($(item))
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .replace(/\n{2,}/g, "\n\n")
        .trim();

      return text;
    });

  return posts.reverse();
}

async function checkTakprogPosts(url, channels) {
  try {
    const posts = await getTakprogPosts(url);

    for (const post of posts) {
      if (!db.has(post)) {
        db.set(post, true);

        console.log(`Sending post | ${post.split("\n")[0]}`);

        const lines = post.split("\n");
        const title = lines[0];
        const description = lines.slice(1).join("\n");

        for (const channel of channels) {
          await client.channels.cache
            .get(channel)
            .send(`**${title}**\n>>> ${description}`)
            .catch(() => {});
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}

async function getDmsPosts(url) {
  const parser = new Parser();

  const feed = await parser.parseURL(url);

  return feed.items
    .map((item) => {
      return {
        title: item.title,
        author: item.creator,
        description: item.contentSnippet,
        link: item.link,
      };
    })
    .reverse();
}

async function checkDmsPosts(url, channels) {
  try {
    const posts = await getDmsPosts(url);

    for (const post of posts) {
      if (!db.has(post.link)) {
        db.set(post.link, true);

        console.log(`Sending post | ${post.title}`);

        for (const channel of channels) {
          await client.channels.cache
            .get(channel)
            .send(
              `**${post.title}**\n>>> ${post.description}\n\n${post.link}\n\nAutor: ${post.author}`
            )
            .catch(() => {});
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function run(func, time) {
  func();
  setInterval(func, time);
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);

  run(
    () =>
      checkTakprogPosts(
        "https://takprog.petlja.org/srednjaskola",
        channelsSrednja
      ),
    1000 * 60 * 5
  );

  run(
    () =>
      checkTakprogPosts(
        "https://takprog.petlja.org/osnovnaskola",
        channelsOsnovna
      ),
    1000 * 60 * 5
  );

  run(() => checkDmsPosts("https://dms.rs/feed/", channelsDms), 1000 * 60 * 5);
});

client.login();

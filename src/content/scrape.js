var data = {
    url: String(window.location.href),
    metadata: {
        title: null,
        author: null
    }
};

// Collect metadata from Youtube.
if (data.url.includes('youtube.com/watch')) {
    try {
        let player = window.wrappedJSObject.ytplayer;
        if (player) {
            data.metadata.title = player.config.args.title;
            data.metadata.author = player.config.args.author;
        }
    } catch (error) {
        // empty
    }
}

data;
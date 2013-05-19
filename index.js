var Twit = require('twit'),
    config = require('./config');

// Make process "fault tolerant" ;-)

process.on('uncaughtException', function(err) {
  console.log(err);
});

// Setup CouchDB connection

var db = new(require('cradle').Connection)(config.db.uri).database(config.db.name);

var T = new Twit({
  consumer_key: config.twitter.consumerKey,
  consumer_secret: config.twitter.consumerSecret,
  access_token: config.twitter.accessToken,
  access_token_secret: config.twitter.tokenSecret
});

var stream = T.stream('statuses/filter', {
  track: '#' + config.hashId
});

stream.on('tweet', function(tweet) {
  db.save(tweet.id_str, tweet);
});
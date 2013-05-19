var Twit = require('twit'),
    config = require('./config');

// Setup CouchDB connection

var db = new(require('cradle').Connection)(config.db.uri).database(config.db.name);

var T = new Twit({
  consumer_key: config.twitter.consumerKey,
  consumer_secret: config.twitter.consumerSecret,
  access_token: config.twitter.accessToken,
  access_token_secret: config.twitter.tokenSecret
});

T.get('search/tweets', { q: '#' + config.hashId }, function(err, reply) {
  if(err) {
    console.log(err);
    return;
  }
  var statuses = reply.statuses;
  for(var i in statuses) {
    var tweet = statuses[i];
    db.save(tweet.id_str, tweet);
  }
});

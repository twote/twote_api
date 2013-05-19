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
 console.log(tweet);
  db.save(tweet.id_str, tweet);
});

// Helper functions

function nice_votes(db_result) {
  var votes = {}, voteHash;
  for(var i in db_result) {
    hash = db_result[i].key;
     // Create vote if not existing yet
    if(! votes[hash]) {
      votes[hash] = {};
    }
    for (var option in db_result[i].value.votes) {
      counter = Object.keys(db_result[i].value.votes[option]).length;
      // Set choice counter
      votes[hash][option] = counter;
    }
  }
  return votes;
}

// Setup express

var express = require('express');
var app = express();

app.get('/:poll?', function(req, res){
  var query = {
    group: true,
    reduce: true
  }
  if(req.param('poll')) query.key = req.param('poll');
  db.view('votes/sumVotesByPoll', query, function(err, db_result) {
    if(err) {
      console.log(err)
      return res.send(500);
    }
    res.send({
      twotes: nice_votes(db_result)
    });
  });
});

app.listen(8000);

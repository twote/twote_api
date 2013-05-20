'use strict';

var Twit   = require('twit'),
    cors   = require('cors'),
    config = require('./config');

// Make process "fault tolerant" ;-)

process.on('uncaughtException', function (err) {
  console.log(err);
});

// Setup CouchDB connection

var db = new(require('cradle')
        .Connection)(config.db.uri)
        .database(config.db.name);

var T = new Twit({
  consumer_key: config.twitter.consumerKey,
  consumer_secret: config.twitter.consumerSecret,
  access_token: config.twitter.accessToken,
  access_token_secret: config.twitter.tokenSecret
});

var stream = T.stream('statuses/filter', {
  track: '#' + config.hashId
});

stream.on('tweet', function (tweet) {
  // Skip our own account id
  if(tweet.user.id_str === config.twitter.idString) return;
  console.log(tweet);
  db.save(tweet.id_str, tweet, function(err, res) {
    if(err) {
      console.log(err);
    } else {
      //send_post_reply(tweet);
    }
  });
});

// Helper functions

function send_post_reply(tweet) {
  var userScreenName = tweet.user.screen_name,
      tweetId = tweet.id_str,
      hashTags = [],
      hashTag

  // Iterate trough hashtags
  for (var i in tweet.entities.hashtags) {
    hashTag = tweet.entities.hashtags[i].text.toLowerCase();
    // Filter out our own hashId
    if (hashTag === config.hashId) continue;
    // Filter double hashtags
    if(hashTags.indexOf(hashTag) > -1) continue;
    // Emit hashtag
    hashTags.push(hashTag);
  }

  // No other tag found but our hashId
  if(hashTags.length < 1) return false;

  var status = '@' + userScreenName + ': Thanks for your #' + config.hashId + '! Here are the results: http://twote.io/twote/' + hashTags[0];
  T.post('statuses/update', { status: status }, function(err, reply) {
    if(err) {
      console.log(err);
    }
  });

}

function nice_votes(db_result) {
  var votes = {},
      hash,
      counter,
      option,
      i;

 for (var i in db_result) {
    hash = db_result[i].key;
    // Create vote if not existing yet
    if (!votes[hash]) {
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

function nice_votes_api(db_result) {
  var niceVotes    = nice_votes(db_result),
      niceVotesApi = [],
      overallVotes = 0,
      i,
      k,
      current,
      improved;

  for (i in niceVotes) {
    if (niceVotes.hasOwnProperty(i)) {
      current = niceVotes[i];

      // calculate overall votes
      overallVotes = 0;
      for (k in current) {
        if (current.hasOwnProperty(k)) {
          overallVotes += current[k];
        }
      }

      improved = {
        twote: i,
        overall_votes: overallVotes
      };

      niceVotesApi.push(improved);
    }
  }

  return niceVotesApi;
}

function nice_votes_api_single(db_result, twoteId) {
  var niceVotes    = nice_votes(db_result),
      niceVotesApi = [],
      overallVotes = 0,
      i,
      k,
      current,
      improved;

  for (i in niceVotes) {
    if (niceVotes.hasOwnProperty(i)) {
      current = niceVotes[i];

      // calculate overall votes
      overallVotes = 0;
      for (k in current) {
        if (current.hasOwnProperty(k)) {
          overallVotes += current[k];
        }
      }

      improved = {
        twote: i,
        overall_votes: overallVotes,
        votes: current
      };

      niceVotesApi.push(improved);
    }
  }

  if (niceVotesApi.length === 0) {
    niceVotesApi.push({
      twote: twoteId,
      overall_votes: 0,
      votes: {}
    });
  }

  return niceVotesApi[0];
}

// Setup express

var express = require('express');
var app     = express();
var server  = require('http').createServer(app);
var io      = require('socket.io').listen(server);

app.use(cors());

app.get('/twote', function (req, res) {
  var query = {
    group: true,
    reduce: true
  };

  db.view('votes/sumVotesByPoll', query, function (err, db_result) {
    if (err) {
      console.log(err);
      return res.send(500);
    }
    res.json({
      result: nice_votes_api(db_result)
    });
  });
});

app.get('/twote/:id', function (req, res) {
  var query = {
    group: true,
    reduce: true,
    key: req.param('id')
  };

  db.view('votes/sumVotesByPoll', query, function (err, db_result) {
    if (err) {
      console.log(err);
      return res.send(500);
    }
    res.json({
      result: nice_votes_api_single(db_result, req.param('id'))
    });
  });
});

app.get('/:poll?', function (req, res) {
  var query = {
    group: true,
    reduce: true
  };
  if (req.param('poll')) {
    query.key = req.param('poll');
  }
  db.view('votes/sumVotesByPoll', query, function (err, db_result) {
    if (err) {
      console.log(err);
      return res.send(500);
    }
    res.send({
      twotes: nice_votes(db_result)
    });
  });
});

io.sockets.on('connection', function (socket) {
  socket.emit('connection_established');
});

server.listen(8000);

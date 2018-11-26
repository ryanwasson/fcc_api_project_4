const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// Not found middleware
/*
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})
*/

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

//Ryan: build the main app below

//define mongoose schema
let userSchema = mongoose.Schema({
  'username': String,
  'exercises': [{'desc': String, 'duration': Number, 'date': Date}]
});

//define mongoose model
let User = mongoose.model('User',userSchema,'Users');

//define db create/save function
function createAndSaveUser(username,done) {
  
  let user = User.findOne({'username':username},function(err,data) {
    if (err) return done(err) ;
    else {
      
      //check if already exists
      if (data != undefined) return done('found');
      
      //does not exist
      else {
        
        let user = new User({'username': username});

        user.save(function(err,data) {
           if (err) return done(err) ;
           else return done(null,data) ;
        }) ;

        return user;
        
      }
    }
  
  }) ;
    
}


//define POST behavior

app.route('/api/exercise/new-user').post(function(req,res) {
  
  createAndSaveUser(req.body.username,function(err,data) {
    if (err) {
      //if (err == 'invalid') return res.json({'error': 'Invalid URL'});
      if (err == 'found') return res.json({'error': 'user name already exists'});
      else return console.log(err) ;
    }
    else {
      return res.json({'username': data['username'], '_id': data['_id']});
    }
  });
  
}) ;

function addExercise(userId,desc,dur,date,done) {
  
  let user = User.findOne({'_id':userId},function(err,user) {
    if (err) return done(err);
    else {
      //console.log('else');
      
       //check if already exists
      if (user == undefined) return done('undefined'); 
      
      //found user
      else {
        if (date == '') date = new Date() ;
        let newExercise = {'desc':desc, 'duration': dur, 'date': date}
        
        //using concat instead of push since $pushall is deprecated
        user.exercises = user.exercises.concat([newExercise]);
        /*
        console.log('user = ');
        console.log(user);
        console.log(user.exercises);
        console.log({'desc':desc, 'duration': dur, 'date': date});
        */
        
        user.save(function(err,data) {
           if (err) return done(err) ;
           else return done(null,data) ;
        }) ;

        return user;
        
      }
      
    }
  });
  
}

app.route('/api/exercise/add').post(function(req,res) {
  addExercise(req.body.userId,req.body.description,req.body.duration,req.body.date, function(err,data) {

    if (err) {
      if (err == 'undefined') return res.json({'error': 'unknown _id'});
      else {
        return console.log(err);
      }
    }
    else {
       return res.json({'username':data.username,'_id':data._id,'exercises':data.exercises[data.exercises.length-1]}); 
    }
  
  });
  

});

//find all user entries in db
function findAllUsers(done) {
  
  let users = User.find({},function(err,data) {
    if (err) return done(err) ;
    else return done(null,data);
  });
                        
  return users ;
  
}

//define GET request to return all users
app.get('/api/exercise/users',function(req,res) {
  let users = findAllUsers(function(err,data) {
    if (err) console.log(err);
    else {
      //console.log(data);
      return res.json(data.map(user => ({'username': user.username,'_id': user._id})));
    }
  }) ;
  
}) ;

function getUserFromId(userId,done) {
   let user = User.findOne({'_id':userId},function(err,user) {
    if (err) return done(err);
    else return done(null,user);
   });
  
}

//define GET request to return the exercises for a particular user
app.get('/api/exercise/log/',function(req,res) {
  let users = getUserFromId(req.query.userid,function(err,data) {
    if (err) console.log(err);
    else {
      return res.json({_id: data._id,
                        username: data.username,
                        count: data.exercises.length,
                        exercises: data.exercises
                                        //filter based on date parameters
                                       .filter(d => {
                                         if (req.query.to != '' && new Date(req.query.to) < d.date) return false ;
                                         if (req.query.from != '' && new Date(req.query.from) > d.date) return false ;
                                         return true;
                                       })
                                       //filter based on limit parameter
                                       .filter((d,i) => {
                                         if (req.query.limit != '' && i+1 > req.query.limit) return false ;
                                         return true;
                                       })
                                       //return only certain fields
                                       .map(d => ({desc: d.desc, duration: d.duration, date: d.date}))});
  }}) ;
  
});

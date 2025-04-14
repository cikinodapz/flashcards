var createError = require('http-errors');
var express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

const authRoutes = require('./routes/auth/authRoutes');
const deckRoutes = require('./routes/deckRoutes')
const flashcardRoutes = require('./routes/flashcardRoutes')

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine', 'jade');
// Replace the existing error handler in app.js


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/user', deckRoutes);
app.use('/user', flashcardRoutes)



app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
// Error handler middleware
app.use(function(err, req, res, next) {
  // Log the error for debugging
  console.error(err);
  
  // Set status code (use the error's status or 500 as default)
  res.status(err.status || 500);
  
  // Always return JSON instead of trying to render a view
  res.json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Only include stack trace in development environment
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;

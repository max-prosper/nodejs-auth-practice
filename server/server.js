require('./config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const { ObjectID } = require('mongodb');

const { mongoose } = require('./db/mongoose');
const { Todo } = require('./models/todo');
const { User } = require('./models/user');
const { authenticate } = require('./middleware/authenticate');

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

//========================== ENDPOINTS ========================//

// SAVE TODO LIST
app.post('/todos', authenticate, (req, res) => {
	let todo = new Todo({
		text: req.body.text,
		_creator: req.user._id
	});

	todo.save().then(
		doc => {
			res.send(doc);
		},
		e => {
			res.status(400).send(e);
		}
	);
});

// GET ALL TODOS
app.get('/todos', authenticate, (req, res) => {
	Todo.find({
		_creator: req.user._id
	}).then(
		todos => {
			res.send({ todos });
		},
		e => {
			res.status(400).send(e);
		}
	);
});

// GET SINGLE TODO ITEM
app.get('/todos/:id', authenticate, (req, res) => {
	let id = req.params.id;

	if (!ObjectID.isValid(id)) {
		return res.status(404).send();
	}

	Todo.findOne({
		_id: id,
		_creator: req.user._id
	})
		.then(todo => {
			if (!todo) {
				return res.status(404).send();
			}

			res.send({ todo });
		})
		.catch(e => {
			res.status(400).send();
		});
});

// DELETE SINGLE TODO ITEM
app.delete('/todos/:id', authenticate, (req, res) => {
	let id = req.params.id;

	if (!ObjectID.isValid(id)) {
		return res.status(404).send();
	}

	Todo.findOneAndRemove({
		_id: id,
		_creator: req.user._id
	})
		.then(todo => {
			if (!todo) {
				return res.status(404).send();
			}

			res.send({ todo });
		})
		.catch(e => {
			res.status(400).send();
		});
});

// EDIT SINGLE TODO ITEM
app.patch('/todos/:id', authenticate, (req, res) => {
	var id = req.params.id;
	var body = _.pick(req.body, ['text', 'completed']);

	if (!ObjectID.isValid(id)) {
		return res.status(404).send();
	}

	if (_.isBoolean(body.completed) && body.completed) {
		body.completedAt = new Date().getTime();
	} else {
		body.completed = false;
		body.completedAt = null;
	}

	Todo.findOneAndUpdate(
		{ _id: id, _creator: req.user._id },
		{ $set: body },
		{ new: true }
	)
		.then(todo => {
			if (!todo) {
				return res.status(404).send();
			}

			res.send({ todo });
		})
		.catch(e => {
			res.status(400).send();
		});
});

// CREATE NEW USER
app.post('/users', (req, res) => {
	let body = _.pick(req.body, ['email', 'password']);
	let user = new User(body);

	user
		.save()
		.then(() => {
			return user.generateAuthToken();
		})
		.then(token => {
			res.header('x-auth', token).send(user);
		})
		.catch(e => {
			res.status(400).send(e);
		});
});

// PRIVATE ROUTE
app.get('/users/me', authenticate, (req, res) => {
	res.send(req.user);
});

// LOGIN USERS
app.post('/users/login', (req, res) => {
	let body = _.pick(req.body, ['email', 'password']);

	User.findByCredentials(body.email, body.password)
		.then(user => {
			return user.generateAuthToken().then(token => {
				res.header('x-auth', token).send(user);
			});
		})
		.catch(e => {
			res.status(400).send();
		});
});

//
app.delete('/users/me/token', authenticate, (req, res) => {
	req.user.removeToken(req.token).then(
		() => {
			res.status(200).send();
		},
		() => {
			res.status(400).send();
		}
	);
});

app.listen(port, () => {
	console.log(`Started up at port ${port}`);
});

module.exports = { app };

#!/usr/bin/env node

const Micro = require('./index');
const os = require('os');
const repl = require('repl');

const micro = new Micro(os.hostname());

repl.start('-> ').context.micro = micro;
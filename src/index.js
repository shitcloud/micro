const amqplib = require('amqplib');
const uuid = require('uuid');
const debug = require('debug')('micro');
const sleep = require('./sleep');

class Micro {
	constructor(name, opts) {
		this.name = name;
		this.opts = { host: 'localhost', ...opts };

		this.connecting = false;
		this.connection = null;
		this.channel = null;
	}

	async connect() {
		if (this.connecting) {
			return sleep(50).then(() => this.connect());
		}

		if (this.connection) {
			return true;
		}

		debug('connecting');
		this.connecting = true;

		this.connection = await amqplib.connect(`amqp://${this.opts.host}`);
		this.channel = await this.connection.createChannel();

		await this.channel.prefetch(1);

		await this.channel.assertExchange('pubsub', 'topic', { durable: false });

		debug('connected');
		this.connecting = false;
		return true;
	}

	/**
	 * @callback subscribeCallback
	 * @param {object} context
	 */

	/**
	 * @function sub
	 * @param {string} topic 
	 * @param {subscribeCallback} callback 
	 */

	async sub(topic, callback) {
		await this.connect();
		debug('subscribing to %s', topic);

		const queue = await this.channel.assertQueue(`queue.${this.name}`, { durable: false, autoDelete: true });
		
		await this.channel.bindQueue(queue.queue, 'pubsub', topic);

		this.channel.consume(queue.queue, async msg => {
			debug('Received message on', topic);
			const ctx = JSON.parse(msg.content.toString());

			await callback(ctx);

			this.channel.ack(msg);
		});
	}

	/**
	 * @function pub
	 * @param {string} topic 
	 * @param {object} params 
	 */

	async pub(topic, params) {
		await this.connect();
		debug('publishing to %s', topic);

		this.channel.publish('pubsub', topic, Buffer.from(JSON.stringify(params)));
	}

	/**
	 * @callback cmdCallback
	 * @param {object} context
	 */

	/**
	 * @function cmd
	 * @param {string} queue 
	 * @param {cmdCallback} callback 
	 */

	async cmd(queue, callback) {
		await this.connect();
		debug('cmd %s', queue);

		this.channel.assertQueue(queue, { durable: false, autoDelete: true });

		this.channel.consume(queue, async msg => {
			const ctx = JSON.parse(msg.content.toString());
			
			ctx.reply = (reply) => {
				this.channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(reply)), { correlationId: msg.properties.correlationId });
			};

			await callback(ctx);

			this.channel.ack(msg);
		});
	}

	/**
	 * @function call
	 * @param {string} queue 
	 * @param {object} params 
	 */

	async call(queue, params) {
		await this.connect();

		const q = await this.channel.assertQueue('', { exclusive: true });
		const correlationId = uuid.v4();

		const response = new Promise((resolve) => {
			this.channel.consume(q.queue, msg => {

				if (msg.properties.correlationId === correlationId) {
					resolve(JSON.parse(msg.content.toString()));
				}

				this.channel.ack(msg);

				resolve(msg.content.toString());

			});
		});

		this.channel.sendToQueue(queue, Buffer.from(JSON.stringify({ params })), { correlationId, replyTo: q.queue });

		return response;
	}
}

module.exports = Micro;
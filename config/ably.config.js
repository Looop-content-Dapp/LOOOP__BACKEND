import Ably from 'ably';

class AblyService {
  constructor() {
    this.ably = new Ably.Realtime(process.env.ABLY_API_KEY);
    this.channels = {};
  }

  // Get or create a channel
  getChannel(channelName) {
    if (!this.channels[channelName]) {
      this.channels[channelName] = this.ably.channels.get(channelName);
    }
    return this.channels[channelName];
  }

  // Publish to a channel
  async publish(channelName, eventName, data) {
    const channel = this.getChannel(channelName);
    await channel.publish(eventName, data);
  }

  // Subscribe to a channel
  subscribe(channelName, eventName, callback) {
    const channel = this.getChannel(channelName);
    channel.subscribe(eventName, callback);
    return () => channel.unsubscribe(eventName, callback);
  }

  // Presence functionality
  async enterPresence(channelName, clientData) {
    const channel = this.getChannel(channelName);
    await channel.presence.enter(clientData);
  }

  async leavePresence(channelName) {
    const channel = this.getChannel(channelName);
    await channel.presence.leave();
  }

  // Get presence members
  async getPresenceMembers(channelName) {
    const channel = this.getChannel(channelName);
    return await channel.presence.get();
  }
}

// Singleton instance
const ablyService = new AblyService();

export default ablyService;

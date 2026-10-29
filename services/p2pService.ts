
import Peer from 'simple-peer';
import { getSupabase } from './bd';

export interface P2PSignal {
  from: string;
  to: string;
  signal: any;
  type: 'offer' | 'answer' | 'candidate';
}

export class P2PManager {
  private supabase: any = null;
  private channel: any = null;
  private peers: Map<string, Peer.Instance> = new Map();
  private onStreamCallback: ((stream: MediaStream, peerId: string) => void) | null = null;
  private myId: string = '';

  constructor(private roomId: string, userId: string) {
    this.myId = userId;
  }

  async initialize() {
    this.supabase = await getSupabase();
    if (!this.supabase) return;

    this.channel = this.supabase.channel(`p2p_signal:${this.roomId}`, {
      config: {
        broadcast: { self: false }
      }
    });

    this.channel
      .on('broadcast', { event: 'signal' }, (payload: any) => {
        const { from, to, signal } = payload.payload;
        if (to === this.myId) {
          this.handleSignal(from, signal);
        }
      })
      .on('broadcast', { event: 'join' }, (payload: any) => {
        const { from } = payload.payload;
        // If I am the host, I should initiate connection to the new joiner
        console.log(`User ${from} joined the room`);
      })
      .subscribe();
  }

  // Host starts broadcasting a stream
  async startBroadcast(stream: MediaStream) {
    if (!this.channel) await this.initialize();

    this.channel.on('broadcast', { event: 'join' }, (payload: any) => {
      const { from } = payload.payload;
      this.initiateConnection(from, stream);
    });
  }

  // Peer joins a room
  async joinRoom(onStream: (stream: MediaStream, peerId: string) => void) {
    this.onStreamCallback = onStream;
    if (!this.channel) await this.initialize();

    // Notify host that I joined
    this.channel.send({
      type: 'broadcast',
      event: 'join',
      payload: { from: this.myId }
    });
  }

  private initiateConnection(peerId: string, stream: MediaStream) {
    if (this.peers.has(peerId)) return;

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream
    });

    peer.on('signal', (data) => {
      this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { from: this.myId, to: peerId, signal: data }
      });
    });

    peer.on('error', (err) => console.error('P2P Error:', err));
    
    this.peers.set(peerId, peer);
  }

  private handleSignal(peerId: string, signal: any) {
    let peer = this.peers.get(peerId);

    if (!peer) {
      // If I'm a peer receiving an offer from host
      peer = new Peer({
        initiator: false,
        trickle: false
      });

      peer.on('signal', (data) => {
        this.channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { from: this.myId, to: peerId, signal: data }
        });
      });

      peer.on('stream', (stream) => {
        if (this.onStreamCallback) {
          this.onStreamCallback(stream, peerId);
        }
      });

      peer.on('error', (err) => console.error('P2P Error:', err));
      this.peers.set(peerId, peer);
    }

    peer.signal(signal);
  }

  destroy() {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
    }
    this.peers.forEach(p => p.destroy());
    this.peers.clear();
  }
}

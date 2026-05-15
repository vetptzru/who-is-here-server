export type RoomInfo = {
  roomId: string;
  name: string;
  clients: number;
  maxClients: number;
  metadata: Record<string, unknown>;
};

export class RoomRegistry {
  private readonly rooms = new Map<string, RoomInfo>();

  public upsert(info: RoomInfo): void {
    this.rooms.set(info.roomId, info);
  }

  public remove(roomId: string): void {
    this.rooms.delete(roomId);
  }

  public list(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }
}

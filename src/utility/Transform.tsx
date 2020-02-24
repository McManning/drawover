
export default class Transform {
    public translate = {
        x: 0,
        y: 0
    };

    public scale = 1;
    public rotate = 0;

    public equals(other: Transform): boolean {
        // TODO: Floating point comparison fixes
        return (
            this.translate.x === other.translate.x &&
            this.translate.y === other.translate.y &&
            this.scale === other.scale &&
            this.rotate === other.rotate
        );
    }
}

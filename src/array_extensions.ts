interface Array<T> {
    truncate(trunclength: number): void;
}

Array.prototype.truncate = function(trunclength: number): void {
    while (this.length > trunclength) {
        this.shift();
    }
};

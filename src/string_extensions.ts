interface String {
    replaceLast(find: string, replace: string): string;
    scrubFilename(): string;
}

String.prototype.replaceLast = function(find, replace): string {
    var index = this.lastIndexOf(find);

    if (index >= 0) {
        return (
            this.substring(0, index) +
            replace +
            this.substring(index + find.length)
        );
    }

    return this.toString();
};

const extensions = ["package", "zip", "rar", "7z"];
String.prototype.scrubFilename = function(): string {
    var str = this.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    extensions.forEach(extension => {
        str = str.replaceLast("_" + extension, "." + extension);
    });
    return str.toString();
};

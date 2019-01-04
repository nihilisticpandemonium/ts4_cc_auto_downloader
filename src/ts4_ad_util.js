const util = require('util');
const stream = require('stream');
const fs = require('fs');
const uuidv4 = require('uuid/v4');

const pipeline = util.promisify(stream.pipeline);
export const sleep = util.promisify(setTimeout);

if (!String.prototype.replaceLast) {
    String.prototype.replaceLast = function (find, replace) {
        var index = this.lastIndexOf(find);

        if (index >= 0) {
            return this.substring(0, index) + replace + this.substring(index + find.length);
        }

        return this.toString();
    };
}

if (!String.prototype.scrubFilename) {
    const extensions = ['package', 'zip', 'rar', '7z'];
    String.prototype.scrubFilename = function () {
        var str = this.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        extensions.forEach((extension) => {
            str = str.replaceLast('_' + extension, '.' + extension);
        });
        return str.toString();
    }
}

if (!Array.prototype.truncate) {
    Array.prototype.truncate = function (trunclength) {
        while (this.length > trunclength) {
            this.shift();
        }
    }
}

export async function writeBinaryDataToFile(fileName, response) {
    await pipeline(
        response.data,
        fs.createWriteStream(fileName)
    );
    return true;
}

export function uuid() {
    return uuidv4();
}

export function formatBytes(a, b) {
    if (0 == a) return "0 Bytes";
    var c = 1024,
        d = b || 2,
        e = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
        f = Math.floor(Math.log(a) / Math.log(c));
    return parseFloat((a / Math.pow(c, f)).toFixed(d)) + " " + e[f]
}

export function titleCase(str) {
    str = str.toLowerCase().split(' ');
    for (var i = 0; i < str.length; i++) {
        str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1); 
    }
    return str.join(' ');
}
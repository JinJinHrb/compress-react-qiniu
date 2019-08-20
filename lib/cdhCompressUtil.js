var _S = require('underscore.string');

/* 检测图片是否有缺损全 START */
var getPixelRect = function(canvas, samplePosition){
    if(!samplePosition){
        samplePosition = {x: 0, y: 0};
        samplePosition.sampleWidth = canvas.width - samplePosition.x;
        samplePosition.sampleHeight = canvas.height - samplePosition.y;
    }
    var ctx = canvas.getContext('2d');
    var imageData = ctx.getImageData(samplePosition.x, samplePosition.y, sampleWidth, sampleHeight);
    var rawData = Array.prototype.slice.call(imageData.data);
    var imageWidth = imageData.width;
    var imageHeight = imageData.height;
    var pixelRect = [];
    for(var i=0, w=0, h=0; i<rawData.length; i+=4){
        if(w === imageWidth){
            w = 0;
            h++;
        }
        var elem = {};
        elem.w = w;
        elem.h = h;
        elem.rgba = [];
        for(var j=0; j<4; j++){
            elem.rgba.push(rawData[i + j]);
        }
        pixelRect.push(elem);
        w++;
    }
    var RTN = {};
    RTN.rawData = rawData;
    RTN.pixelRect = pixelRect;
    RTN.imageWidth = imageWidth;
    RTN.imageHeight = imageHeight;
    return RTN;
}

var isRawDataPureWhite = function(pixel){
    var rawData = Array.prototype.slice.call(pixel);
    for(var i=0; i<3; i++){
        if(rawData[i] < 255){
            return false;
        }
    }
    return true;
}

var findWhitePoint = function(ctx, canvasWidth, y, result){
    if(!result.y){
        result.y = y;
        result.whitePoint = -1;
    }
    if(!result.left){
        result.left = Math.floor(canvasWidth / 2);
    }
    if(!result.right){
        result.right = Math.floor(canvasWidth / 10 * 9);
    }
    var rawDataLeft = ctx.getImageData(result.left, y, 1, 1).data;
    var rawDataRight = null;
    if(result.left === result.right){
        rawDataRight = rawDataLeft;
    }else{
        rawDataRight = ctx.getImageData(result.right, y, 1, 1).data;
    }
    if(!isRawDataPureWhite(rawDataRight)){
        if(result.lastRight){
            result.whitePoint = result.lastRight;
        }
        return;
    }
    if(isRawDataPureWhite(rawDataLeft)){
        result.whitePoint = result.left;
        return;
    }
    result.lastRight = result.right;
    var leftToRightWidth = result.right - result.left;
    var aQuarter = Math.floor(leftToRightWidth / 4);
    var newLeft = result.left + aQuarter;
    var newRight = result.right - aQuarter;
    if(newLeft >= newRight || aQuarter === 0){
        result.left = result.right = result.left + (aQuarter * 2);
    }else{
        result.left = newLeft;
        result.right = newRight;
    }
    findWhitePoint(ctx, canvasWidth, y, result);
}

// var isMobilePhone = () => {
//     return sessionStorage.getItem('rcl#isMobile') === 'Y';
// };

var isImgPartLoad = function(canvas, isMobile){
    // if(!isMobilePhone()){
    //     return false;
    // }
    if(isMobile !== 'Y'){
        return false;
    }
    /*var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0, img.width, img.height)*/
    var ctx = canvas.getContext('2d');
    var canvasWidth = canvas.width;
    var canvasHeight = canvas.height;
    var sampleCount = 7;
    var deltaH = Math.floor(canvasHeight / sampleCount);
    var samples = [];
    for(var i=1; i<sampleCount; i++){
        var result = {};
        findWhitePoint(ctx, canvasWidth, deltaH * i, result);
        samples.push(result);
    }
    // console.log('isImgPartLoad - samples', samples);
    var whitePointCountObj = {};
    for(var i=0; i<samples.length; i++){
        var theSample = samples[i];
        var whitePoint = theSample.whitePoint;
        if(whitePoint < 0){
            continue;
        }
        if(!whitePointCountObj[whitePoint]){
            whitePointCountObj[whitePoint] = 1;
        }else{
            whitePointCountObj[whitePoint] = whitePointCountObj[whitePoint] + 1;
        }
    }
    // console.log('isImgPartLoad - whitePointCountObj', whitePointCountObj);
    var whitePoints = Object.keys(whitePointCountObj);
    for(var i=0; i<whitePoints.length; i++){
        var key = whitePoints[i];
        if(whitePointCountObj[key] > 1){
            return true;
        }
    }
    return false;
}
/* 检测图片是否有缺损全 END */

/* 压缩用 START */
var canvas = document.createElement('canvas');
var ctx = canvas.getContext('2d');
//    瓦片canvas
var _defaultProcessParams = {
    maxsize: 600 * 1024
    , minsize: 200 * 1024
    , standardLength: 1200
    , enlargePolicy: 'sizeFirst'
}
/* 压缩用 END */

var _maxImgWidth = 10000; // 加载原图的最大图片宽度

var enlargeSize = function(img, options){
    options = Object.assign(_defaultProcessParams, options);
    var enlargePolicy = _S.trim(options.enlargePolicy);
    var initSize = img.src.length;
    var width = img.width;
    var height = img.height;
    var ndata = null;
    var enlargeRatio = 1;
    var ndataLength = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    while( (!ndata || ndata.length < options.minsize) && enlargeRatio < 100 ){
        if(ndata){
            ndataLength = ndata.length;
        }
        var upDelta =  Math.floor(options.minsize - ndataLength) / 1000;
        if(upDelta < 1){
            upDelta = 1;
        }else if(upDelta > 10){
            upDelta = 10
        }
        upDelta /= 100;
        enlargeRatio += upDelta;
        var enlargeWidth = width * enlargeRatio;
        var enlargeHeight = height * enlargeRatio;
        canvas.width = enlargeWidth;
        canvas.height = enlargeHeight;
        // 铺底色
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ndata = canvas.toDataURL('image/jpeg');
        if(enlargePolicy === 'standardLengthFirst' && (enlargeWidth > options.standardLength || enlargeHeight > options.standardLength)){
            break;
        }
    }
    canvas.width = canvas.height = 0;
    return ndata;
};

var getShrinkRatio = function(img, options){
    options = Object.assign(_defaultProcessParams, options);
    var width = img.width;
    var height = img.height;
    //console.log(new Date(), 'img.width ->', width);
    //console.log(new Date(), 'img.height ->', height);
    var shrinkRatio = 1;
    if(width > height && height > options.standardLength){
        shrinkRatio = options.standardLength/height;
    }else if(width < height && width > options.standardLength){
        shrinkRatio = options.standardLength/width;
    }
    if(shrinkRatio < 0.5){
        shrinkRatio = 0.5;
    }
    return shrinkRatio;
};

var compress = function(img, options, isMobile){
    options = Object.assign(_defaultProcessParams, options);
    var shrinkRatio = getShrinkRatio(img, options);
    //console.log(new Date(), 'shrinkRatio =', shrinkRatio);
    var initSize = img.src.length;
    var width = img.width;
    var height = img.height;
    // 如果图片大于四五万像素，计算压缩比并将大小压至400万以下
    var ratio;
    if ((ratio = width * height / 4000000) > 1) {
        ratio = Math.sqrt(ratio);
        width /= ratio;
        height /= ratio;
    } else {
        ratio = 1;
    }
    canvas.width = width * shrinkRatio;
    canvas.height = height * shrinkRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 铺底色
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 如果图片像素大于100万则使用瓦片绘制
    var count;
    if ((count = width * height / 1000000) > 1) {
        count = ~~(Math.sqrt(count) + 1); //计算要分成多少块瓦片
        // 计算每块瓦片的宽和高
        var nw = ~~(width / count) * 1.01;
        var nh = ~~(height / count) * 1.01;
        // var tCanvasWidth = nw * shrinkRatio;
        // var tCanvasHeight = nh * shrinkRatio;
        for (var i = 0; i < count; i++) {
            for (var j = 0; j < count; j++) {
                /*
                var tCanvas = document.createElement('canvas');
                tCanvas.width = tCanvasWidth;
                tCanvas.height = tCanvasHeight;
                var tctx = tCanvas.getContext('2d');
                // tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, tCanvas.width, tCanvas.height);
                // void ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
                tctx.drawImage(img, i * nw * ratio, j * nh * ratio, nw * ratio, nh * ratio, 0, 0, nw * shrinkRatio, nh * shrinkRatio);
                ctx.drawImage(tCanvas, i * nw * shrinkRatio, j * nh * shrinkRatio, nw * shrinkRatio, nh * shrinkRatio);
                */
                ctx.drawImage(img, i * nw * ratio, j * nh * ratio, nw * ratio, nh * ratio, i * nw * shrinkRatio, j * nh * shrinkRatio, nw * shrinkRatio, nh * shrinkRatio);
            }
        }
    } else {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    if(isImgPartLoad(canvas, isMobile) && options.originResult){
        return options.originResult;
    }
    // 进行最小压缩
    var compressRatio = 1;
    var ndata = canvas.toDataURL('image/jpeg', compressRatio);
    while(compressRatio > 0 && ndata.length > options.maxsize){
        var minusDelta = Math.floor(ndata.length - options.maxsize / 5000);
        if(minusDelta < 0){
            minusDelta = 1;
        }else if(minusDelta > 5){
            minusDelta = 5;
        }
        compressRatio -= (minusDelta / 100);
        ndata = canvas.toDataURL('image/jpeg', compressRatio);
    }
    canvas.width = canvas.height = 0;
    return ndata;
};
exports.compress = compress;

/**
 * 获取blob对象的兼容性写法
 * @param buffer
 * @param format
 * @returns {*}
 */
var getBlob = function(buffer, format){
    try {
        return new Blob(buffer, {type: format});
    } catch (e) {
        var bb = new (window.BlobBuilder || window.WebKitBlobBuilder || window.MSBlobBuilder);
        buffer.forEach(function (buf) {
            bb.append(buf);
        });
        return bb.getBlob(format);
    }
}
exports.getBlob = getBlob;

var getBlobByBase64 = function(base64, type){
    var text = window.atob(base64.split(',')[1]);
    var buffer = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) {
        buffer[i] = text.charCodeAt(i);
    }
    return getBlob([buffer], type);
};
exports.getBlobByBase64 = getBlobByBase64;

var lowerCaseFileNameSuffix = function(fileName){
    if(typeof(fileName) !== 'string' ){
        return fileName;
    }
    var lastDotIdx = fileName.lastIndexOf('.');
    if(lastDotIdx < 0 || lastDotIdx === fileName.length - 1){
        return fileName;
    }
    var fileNameWithoutSuffix = fileName.slice(0, lastDotIdx + 1);
    var fileNameSuffix = fileName.slice(lastDotIdx + 1);
    return fileNameWithoutSuffix + fileNameSuffix.toLowerCase();
};

exports.handleUploadFilesPromise = function(files, options, isMobile){
    options = Object.assign(_defaultProcessParams, options);
    var singleFilePromise = function(file){
        return new Promise(function(rsv, rej){
            if(!(file instanceof File)){
                console.error('wrong file for "handleUploadFilesPromise" ->', file);
                return rsv(file);
            }
            var fileName = lowerCaseFileNameSuffix(file.name);
            // if (!/^image\//i.test(file.type.toLowerCase())) return rsv(file);
            var isImage = /^image\//i.test(file.type.toLowerCase());
            var reader = new FileReader();
            var size = file.size / 1024 > 1024 ? (~~(10 * file.size / 1024 / 1024)) / 10 + 'MB' : ~~(file.size / 1024) + 'KB';
            reader.onload = function (evt) {
                var result = evt.currentTarget.result;
                if(!isImage){
                    return rsv({data: result, fileType: file.type, fileName: fileName});
                }
                var toCompress = false;
                var toEnlarge = false;
                var img = new Image();
                var callback = function(){
                    var noEnlarge = _S.trim(options.noEnlarge);
                    if(_S.trim(options.enlargePolicy) === 'standardLengthFirst' && (img.width > options.standardLength || img.height > options.standardLength) ){
                        noEnlarge = 'Y';
                    }
                    // 如果图片大小小于${maxsize}，且大于${minsize}，则直接上传
                    // if (result.length > options.maxsize) {
                    if (
                        result.length > options.maxsize ||
                        (_S.trim(options.enlargePolicy) === 'standardLengthFirst' && (img.width > options.standardLength || img.height > options.standardLength))
                    ) {
                        toCompress = true;
                    }else if(result.length < options.minsize && !noEnlarge){
                        toEnlarge = true;
                    }
                    if (!toCompress && !toEnlarge) {
                        img = null;
                        rsv({data: result, fileType: file.type, fileName: fileName});
                        return;
                    }
                    // 图片加载完毕之后进行压缩，然后上传
                    options.originResult = result; // 如果检测到图片损坏，使用原始图
                    var data = toEnlarge ? enlargeSize(img, options) : compress(img, options, isMobile);
                    rsv({data: data, fileType: file.type, fileName: fileName});
                    img = null;
                }
                var preCallback = function(maxStandLength){
                    var imgWidth = img.width;
                    var imgHeight = img.height;
                    /*if(imgWidth > 10000 || imgHeight > 10000){ // 超大图片处理
                        rsv({data: result, fileType: file.type, fileName: fileName});
                    }else */if(imgWidth < _maxImgWidth && imgHeight < _maxImgWidth){
                        callback();
                    }else{
                        // var isWidthShorter = imgWidth < imgHeight;
                        // var shrinkRatioPreCb = isWidthShorter ? imgHeight / _maxImgWidth : imgWidth / _maxImgWidth;
                        img = new Image();
                        img.src = result;
                        img.width = imgWidth; /* / shrinkRatioPreCb */
                        img.height = imgHeight; /* / shrinkRatioPreCb */
                        img.onload = callback;
                    }
                };
                img.src = result;
                // img.maxWidth = options.standardLength || 1500;
                // img.maxHeight = options.standardLength || 1500;
                if (img.complete) {
                    callback();
                } else {
                    img.onload = preCallback.bind(this, (options.standardLength || 1500));
                }
            };
            reader.readAsDataURL(file);
        });
    }
    return new Promise(function(rsv, rej){
        var results = [];
        for(var i=0; i<files.length; i++){
            var file = files[i];
            singleFilePromise(file).then(function(feed){
                // console.log('getBlobByBase64(feed.data, feed.fileType) ->', feed); // debug only
                feed.blob = getBlobByBase64(feed.data, feed.fileType);
                results.push(feed);
                if(results.length === files.length){
                    rsv(results);
                }
            });
        }
    });

};

exports.blobToFile = function (theBlob, fileName) {
    //A Blob() is almost a File() - it's just missing the two properties below which we will add
    theBlob.lastModifiedDate = new Date();
    theBlob.name = lowerCaseFileNameSuffix(fileName);
    return theBlob;
}

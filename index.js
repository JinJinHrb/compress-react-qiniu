/*global URL */

'use strict';
var React = require('react');
var ReactDOM = require('react-dom')
var request = require('superagent-bluebird-promise');
var cdhCompressUtil = require('./lib/cdhCompressUtil');

var isFunction = function (fn) {
    var getType = {};
    return fn && getType.toString.call(fn) === '[object Function]';
};

var ReactQiniu = React.createClass({
    // based on https://github.com/paramaggarwal/react-dropzone
    propTypes: {
        onDrop: React.PropTypes.func.isRequired,
        token: React.PropTypes.string.isRequired,
        // called before upload to set callback to files
        onUpload: React.PropTypes.func,
        size: React.PropTypes.number,
        style: React.PropTypes.object,
        supportClick: React.PropTypes.bool,
        accept: React.PropTypes.string,
        multiple: React.PropTypes.bool,
        isMobile: React.PropTypes.string,
        // Qiniu
        uploadUrl: React.PropTypes.string,
        prefix: React.PropTypes.string,
        adjustImageSize: React.PropTypes.object // 是否自动调整图片尺寸
    },

    getDefaultProps: function() {
        return {
            supportClick: true,
            multiple: true,
            uploadUrl: 'http://upload.qiniu.com/'
        };
    },

    getInitialState: function() {
        return {
            isDragActive: false
        };
    },

    onDragLeave: function(e) {
        this.setState({
            isDragActive: false
        });
    },

    onDragOver: function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';

        this.setState({
            isDragActive: true
        });
    },

    onDrop: function(e) {
        e.preventDefault();

        this.setState({
            isDragActive: false
        });
        var files;
        if (e.dataTransfer) {
            files = e.dataTransfer.files;
        } else if (e.target) {
            files = e.target.files;
        }
        var callback = function(feed){
            // console.log('cdhCompressUtil.handleUploadFilesPromise ->', feed); // debug only
            var maxFiles = (this.props.multiple) ? files.length : 1;
            if (this.props.onUpload) {
                if(this.props.adjustImageSize){
                    files = Array.prototype.slice.call(feed, 0, maxFiles).map(function(elem, idx){
                        return cdhCompressUtil.blobToFile(feed[idx].blob, feed[idx].fileName)
                    });
                }else{
                    files = Array.prototype.slice.call(files, 0, maxFiles);
                }
                this.props.onUpload(files, e);
            }

            for (var i = 0; i < maxFiles; i++) {
                files[i].preview = URL.createObjectURL(files[i]);
                files[i].request = this.upload(files[i]);
                files[i].uploadPromise = files[i].request.promise();
            }

            if (this.props.onDrop) {
                files = Array.prototype.slice.call(files, 0, maxFiles);
                this.props.onDrop(files, e);
            }
        }
        if(this.props.adjustImageSize){
            cdhCompressUtil.handleUploadFilesPromise(files, this.props.adjustImageSize, this.props.isMobile).then(callback.bind(this));
        }else{
            callback.call(this, files);
        }
    },

    onClick: function () {
        if (this.props.supportClick) {
            this.open();
        }
    },

    open: function() {
        var fileInput = ReactDOM.findDOMNode(this.refs.fileInput);
        fileInput.value = null;
        fileInput.click();
    },

    upload: function(file) {
        if (!file || file.size === 0) return null;
        var key = file.preview.split('/').pop() + '.' + file.name.split('.').pop();
        if (this.props.prefix) {
            key = this.props.prefix  + key;
        }
        var r = request
            .post(this.props.uploadUrl)
            .field('key', key)
            .field('token', this.props.token)
            .field('x:filename', file.name)
            .field('x:size', file.size)
            .attach('file', file, file.name)
            .set('Accept', 'application/json');
        if (isFunction(file.onprogress)) { r.on('progress', file.onprogress); }
        return r;
    },

    render: function() {
        var className = this.props.className || 'dropzone';
        if (this.state.isDragActive) {
            className += ' active';
        }

        var style = this.props.style || {
            width: this.props.size || 100,
            height: this.props.size || 100,
            borderStyle: this.state.isDragActive ? 'solid' : 'dashed'
        };


        return (
            React.createElement('div', {className: className, style: style, onClick: this.onClick, onDragLeave: this.onDragLeave, onDragOver: this.onDragOver, onDrop: this.onDrop},
                React.createElement('input', {style: {display: 'none'}, type: 'file', multiple: this.props.multiple, ref: 'fileInput', onChange: this.onDrop, accept: this.props.accept}),
                this.props.children
            )
        );
    }

});

module.exports = ReactQiniu;

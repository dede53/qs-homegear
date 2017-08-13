var adapter					=	require('../../adapter-lib.js');
var homegear				=	new adapter("homegear");
var rpc 					=	require('binrpc');
var devices					=	{};
var homegearPort			=	parseInt(homegear.settings.portLocal);
var rpcServer				=	rpc.createServer({host: homegear.settings.ipLocal, port: homegearPort});
var rpcClient				=	rpc.createClient({host: homegear.settings.ipCCU, port: homegear.settings.portCCU});

process.on("message", function(request){
	var data				= request.data;
	var status				= request.status;
	if(data){
		switch(data.protocol){
			case "setSetting":
				homegear.setSetting(data);
				break;
			case "shutter":
				homegear.log.debug(data.CodeOn, status);
				if(status == "stop"){
					var type = "STOP";
					var value = true;
				}else{
					var type = "LEVEL";
					var value = status;
				}
				rpcClient.methodCall('setValue', [data.CodeOn, type, value], function (err, res) {
					homegear.log.debug(err);
					if(err){
						homegear.log.error(JSON.stringify(err));
						homegear.log.error(JSON.stringify(res));
					}else{
						devices[data.CodeOn] = data;
						devices[data.CodeOn].status = value;
					}
				});
				break;
			default:
				homegear.log.error("Problem mit dem Protocol:" + data.protocol);
				break;
		}
	}
});

rpcServer.on('system.listMethods', function (err, params, callback) {
	callback(null, ['system.listMethods', 'system.multicall', 'event', 'listDevices']);
});

rpcServer.on('listDevices', function (err, params, callback) {
	callback(null, []);
});

rpcServer.on('event', function (err, params, callback) {
	handleEvent(params);
	callback(null, '');
});

rpcServer.on('system.multicall', function (err, params, callback) {
	var response = [];
	params[0].forEach(function (call) {
		handleEvent(call);
	});
	callback(null, '');
});

subscribe();

/**
 * Tell the CCU that we want to receive events
 */
function subscribe() {
	homegear.log.debug('xmlrpc_bin://' + homegear.settings.ipLocal + ':' + homegearPort);
	rpcClient.methodCall('init', ['xmlrpc_bin://' + homegear.settings.ipLocal + ':' + homegearPort , 'QuickSwitch'], function (err, res) {
		if(err){
			homegear.log.error(err);
		}else{
			homegear.log.debug(res);
		}
		process.send({"statusMessage": "Läut auf Port:" + homegearPort});
	});
}

function handleEvent(call){
	var params = call.params;
	switch(params[2]){
		case "LEVEL":
			var status = parseFloat(params[3]);
			homegear.log.debug("Status: " + params[1] + " " + status);
			if(typeof devices[params[1]] == 'object'){
				devices[params[1]].status = status;
				homegear.setDeviceStatus(devices[params[1]].deviceid, status);
			}
			break;
		case "WORKING":
		case "DIRECTION":
			break;
		default:
			homegear.log.debug(JSON.stringify(params));
			break;
	}
}

process.on('SIGINT', function () {
	unsubscribe();
});


/**
 * Tell the CCU that we no longer want to receive events
 */
function unsubscribe() {
	homegear.log.debug('xmlrpc_bin://' + homegear.settings.ipLocal + ':' + homegearPort);
	rpcClient.methodCall('init', ['xmlrpc_bin://' + homegear.settings.ipLocal + ':' + homegearPort , ''], function (err, res) {
		homegear.log.error(err, res);
		process.exit(0);
	});
	setTimeout(function () {
		homegear.log.error('force quit');
		process.exit(1);
	}, 1000);
}
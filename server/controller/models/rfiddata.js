/****************************************************************************
**
** Copyright (C) 2015
**                     Gustavo Valiati <gustavovaliati@gmail.com>
**                     Thiago R. M. Bitencourt <thiago.mbitencourt@gmail.com>
**
** This file is part of the FishMonitoring project
**
** This program is free software; you can redistribute it and/or
** modify it under the terms of the GNU General Public License
** as published by the Free Software Foundation; version 2
** of the License.
**
** This program is distributed in the hope that it will be useful,
** but WITHOUT ANY WARRANTY; without even the implied warranty of
** MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
** GNU General Public License for more details.
**
** You should have received a copy of the GNU General Public License
** along with this program; if not, write to the Free Software
** Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
**
****************************************************************************/

'use strict';
var logger = require('winston');
var q = require('q');
var sequelize = require(__base + 'controller/database/platformsequelize');
var BaseController = require(__base + 'controller/basemodelctrl');
var errorHandler = require(__base + 'utils/errorhandler');

var DEValidator = require(__base + 'controller/dynamic/devalidator');
var CollectorCtrl = require(__base + 'controller/models/collector');
var Collector = sequelize.model('Collector');
var Package = sequelize.model('Package');
var RfidImport = sequelize.model('RfidImport');

var RfidModel = sequelize.model('Rfiddata');
var Rfid = new BaseController(RfidModel, 'rfiddatas');

var changeFunc = function(body, callback){
    var errMessage = {error: "Not Allowed", code: 403, message: "You are not allowed to make any change on rfidDatas"};
    callback(errMessage);
};

/**
* Custom function. Implements the not allowed operation response.
*
* @memberof ModelControllers
* @function
*/
Rfid.custom['remove'] = changeFunc;

/**
* Custom function. Implements the not allowed operation response.
*
* @memberof ModelControllers
* @function
*/
Rfid.custom['save'] = changeFunc;

/**
* New function. This is a copy of the default function.
*
* @memberof ModelControllers
* @function
*/
Rfid.defaultSave = Rfid.save;

/**
* Returns the field that contains the RFIDCODE type from the given entity.
* @param  {String}   identifier  the entity identifier
* @param  {Function} callback  callback for when done, receives an error as first parameter and the returned field as second parameter.
* @return {void}
* @memberof ModelControllers
*/
var getDynamicEntity = function(identifier, callback){
    var dynamic = sequelize.model('DynamicEntity');
    dynamic.findOne({where: {identifier: identifier}})
    .then(function(entityDef){
        if(!entityDef){
            return callback({error: 'The given identifier does not match to any dynamic entity', code: 404, message:'Dynamic Entity Not found'});
        }

        var structure = JSON.parse(entityDef.meta).structureList;
        var entityField = structure.filter(function(element){
            return element.type === DEValidator.prototype.typesEnum.RFIDCODE;
        })
        .map(function(el){ return el.identifier})[0];
        if(!entityField){
            return callback({error: 'The Dynamic Entity must have one RFIDCODE Field', code: 404, message:'RFIDCODE Field Not found'});
        }

        return callback(null, entityField);
    })
    .catch(function(e){
        return callback({error: e.toString(), code: 500, message:"Error on find DynamicEntity"});
    });
};

/**
* Returns the field that contains the RFIDCODE type from the given entity.
* @param  {Object} query        the sequelize query
* @param  {Array} codesRelated array of RFID codes that should match to the register.
* @return {void}
* @memberof ModelControllers
*/
var getEntities = function(query, codesRelated){
    var deferred = q.defer();

    getDynamicEntity(query.entity, function(err, entityField){
        if(err){
            deferred.reject(err);
            return;
        }

        var entityQuery = query.entityQuery || {};
        if(!entityQuery.where)
        entityQuery.where = {};
        entityQuery.where[entityField] = {$in: codesRelated};

        try{
            var model = sequelize.model(query.entity);
            model.findAndCountAll(entityQuery)
            .then(function(result){
                var responseObj = {};
                result.rows.forEach(function(element){
                    responseObj[element[entityField]] = element;
                });
                result.data = responseObj;
                deferred.resolve(result);
            })
            .catch(function(e){
                var errMessage = {error: e.toString(), code: 500, message:"Error on find Entities"};
                deferred.reject(errMessage);
            });
        }catch(e){
            var errMessage = {error: e.toString(), code: 500, message:"Error on load DynamicEntity"};
            deferred.reject(errMessage);
        }
    });
    return deferred.promise;
};

/**
* Find rfiddata relating the rfid codes to an specific entity.
* @param  {Object}   query    Contains the sequelize query, and wanted entity to relate to.
* @param  {Function} callback callback for when done, receives an error as first parameter and the returned field as second parameter.
* @return {void}
* @memberof ModelControllers
*/
var embeddedRecords = function(query, callback){
    getDynamicEntity(query.entity, function(err, entityField){
        if(err)
        return callback(err);

        var entityQuery = query.entityQuery || {};
        if(!entityQuery.where)
        entityQuery.where = {};
        var inQuery = undefined;
        if(query.where && query.where.rfidCode){
            var rfidquery = query.where.rfidCode;
            if(typeof rfidquery === 'object'){
                inQuery = rfidquery;
            }else{
                inQuery = {$in: [rfidquery]}
            }
        }
        if(inQuery)
        entityQuery.where[entityField] = inQuery;

        var model = sequelize.model(query.entity);
        model.findAll(entityQuery)
        .then(function(ety){
            var size = 0;
            var response = [];
            ety.forEach(function(el){
                query.where = query.where || {};
                query.where.rfidCode = query.where.rfidCode || el[entityField];
                if(query.where.rfidCode !== el[entityField])
                    query.where.rfidCode = el[entityField];

                query.order = query.order || [['rfidReadDate', 'DESC']];

                //TODO: This might result in a problem in the future.
                RfidModel.findAndCountAll(query)
                .then(function(records) {
                    var res = el.get({plain: true});
                    res.records = records;
                    response.push(res);
                    size++;
                    if(size === ety.length)
                        return callback(null, response);
                })
                .catch(function(err) {
                    return callback({error: err.toString(), code: 500, message:"Error on find RFIDDatas for Embedded Records"});
                });
                // Rfid.find(null, query, function(err, records){
                //   if(err)
                //     return callback(err);
                //
                //   var res = el.get({plain: true});
                //   res.records = records;
                //   response.push(res);
                //   // return callback(null, res);
                //   size++;
                //   if(size === ety.length)
                //     return callback(null, response);
                // });
            });
        })
        .catch(function(e){
            return callback({error: e.toString(), code: 500, message:"Error 0"});
        });
    });
};

/**
 * Returns a list of unique rfidcodes from the given records.
 * @param  {Object} records are the rfiddata registers
 * @return {Array}         a list of non-repeated rfid codes
 * @memberof ModelControllers
 */
var codesRelated = function(records) {
    var tmpObj = {};
    return records.filter(function(current){
        if(tmpObj[current.rfidCode])
            return false;

        tmpObj[current.rfidCode] = current;
            return true;
    })
    .map(function(current){return current.rfidCode});
}

/**
 * Attach a dynamic entity register to every rfid data.
 * @param  {Array} records the rfiddata list
 * @param  {Object} data    the dynamic entity registers map.
 * @return {Array}         the rfiddata list. Every register contains a dynamic entity related to.
 * @memberof ModelControllers
 */
var attachEntity = function(records, data) {
    var responseObj = [];
    records.forEach(function(record){
        var entity = data[record.rfidCode];
        if(entity){
            var tmp = record.get({plain:true});
            tmp.entity = entity;
            delete tmp.Package;
            responseObj.push(tmp);
        }
    });
    return responseObj;
}

/**
 * Executes the main rfiddata find operation.
 * @param  {Object}   query    Sequelize query
 * @param  {Function} callback callback for when done, passing the first parameter
 * as error and the second as the query result.
 * @return {void}
 * @memberof ModelControllers
 */
var paginateRfid = function(query, callback) {
    RfidModel.findAndCountAll(query)
    .then(function(result) {
        var records = result.rows;
        if(records.length > 0 && (query && query.entity)){
            getEntities(query, codesRelated(records))
            .then(function(data){
                var data = data.data;
                result.rows = attachEntity(records, data);
                return callback(null, result);
            }, function(err) { //Node promise, not Sequelize catch function
                return callback(err);
            });
        } else {
            return callback(null, result);
        }
    })
    .catch(function(err) {
        return callback({error: err.toString(), code: 500, message:"Error on find RFIDDatas"});
    });
}

/**
 * Executes a rfiddata find operation, controlling the limit and offset manually
 * @param  {Object}   query    Sequelize query with aditional application fields
 * @param  {Function} callback callback for when done, passing the first parameter
 * as error and the second as the query result.
 * @return {void}
 * @memberof ModelControllers
 */
var paginateEntity = function(query, callback) {
    var limit = query.limit;
    var offset = query.offset;
    query.limit = undefined;
    query.offset = undefined;

    RfidModel.findAll(query)
    .then(function(result) {
        var records = result;
        if(records.length > 0 && (query && query.entity)){
            getEntities(query, codesRelated(records))
            .then(function(data){
                var data = data.data;
                var responseObj = attachEntity(records, data);
                var newResponse = {count: responseObj.length, rows:[]};
                var start = offset || 0;
                if (limit < responseObj.length)
                    newResponse.rows = responseObj.splice(start, limit);
                else
                    newResponse.rows = responseObj;
                return callback(null, newResponse);
            }, function(err) { //Node promise, not Sequelize catch function
                return callback(err);
            });
        } else {
            return callback(null, result);
        }
    }, function(err) { //Node promise, not Sequelize catch function
        return callback(err);
    });
}

/**
 * [embeddedEntity description]
 * @param  {Object}   query    Sequelize query with aditional application fields
 * @param  {Function} callback callback for when done, passing the first parameter
 * as error and the second as the query result.
 * @return {void}
 * @memberof ModelControllers
 */
var embeddedEntity = function(query, callback) {
    if(query.entityQuery) {
        return paginateEntity(query, callback);
    } else {
        return paginateRfid(query, callback);
    }
};

/**
 * Defines the minimum number of registers that can be specified for a limit specification
 * @type {Number}
 * @memberof ModelControllers
 */
var LIMIT_MIN_RFIDDATA = 1;

/**
 * Defines the maximum number of registers that can be specified for a limit specification
 * @type {Number}
 * @memberof ModelControllers
 */
var LIMIT_MAX_RFIDDATA = 500;
/**
 * The default value for the query.
 * @type {Number}
 * @memberof ModelControllers
 */
var LIMIT_DEFAULT = 100;

/**
 * Custom function. If the id is present, executes a findById returning a single register.
 * Otherwise, queries looking for limits definitions and dyanamic entities.
 * @memberof ModelControllers
 */
Rfid.custom['find'] = function(id, query, callback){
    // select * from tb_plat_rfiddata as rfid, tb_de_carro as carro where rfid."rfidCode" = carro.pit;
    // return Rfid.find(id, query, callback); //Just go ahead
    if(id){
        return Rfid.find(id, query, callback);
    }else if(query) {
        // Valid query
        if (query.limit && (query.limit < LIMIT_MIN_RFIDDATA || query.limit > LIMIT_MAX_RFIDDATA))
            return callback({error: "The limit is less than minimum or greater than the maximum allowed value", code: 400, message: "Invalid limit value"});

        if (query.offset && query.offset < 0)
            return callback({error: "The offset must be greater than zero", code: 400, message: "Invalid offset value"});

        query.limit = query.limit || LIMIT_DEFAULT; //Default limit
        query.offset = query.offset || null;

        if(query.embeddedRecords === true) {
            if(query.entity)
                return embeddedRecords(query, callback);
            else
                return callback({error: "To query with embeddedRecords being true, the 'entity' parameter is mandatory", code: 400, message: "Missing entity parameter"});
        } else {
            return embeddedEntity(query, callback);
        }
    }
};

/**
 * Receives a packet of rfiddatas to insert in the database.
 * @param  {Array}   rfiddata  is the packet, structured as the protocol defines.
 * @param  {Object}   collector is the collector related to the packet.
 * @param  {Function} callback  callback for when done, passing the first parameter
 * as error and the second a object containing the packet hash, its size and if it is new or a duplicated.
 * @return {void}
 * @memberof ModelControllers
 */
var insertSummary = function(rfiddata, collector, callback){

    if(rfiddata.data.length === 0){
        logger.warn("Empty package received. send ACK-DATA");
        return callback(null, {hash: rfiddata.md5diggest});
    }

    var pack = {
        packageHash: rfiddata.md5diggest,
        packageSize: rfiddata.data.length
    };

    sequelize.transaction().then(function(t){
        return Package.create(pack, {transaction:t})
        .then(function(newPk){

            var rfidDataList = rfiddata.data;

            var errorList = [];
            var loopDone = function(err){
                rfidDataListCounter++;

                if(err){
                    errorList.push(err);
                }

                if(rfidDataListCounter === pack.packageSize){
                    if(errorList.length > 0){
                        t.rollback(); //return ?
                        callback(errorList, {hash: newPk.packageHash, size: pack.packageSize});
                    }else{
                        t.commit(); //return ?
                        callback(null, {hash: newPk.packageHash, size: pack.packageSize, new : true});
                    }
                }

            }

            //Without timezone
            //2015-08-18T18:08:40
            var datePatternA = /\d{4}-?\d{2}-?\d{2}T\d{2}:\d{2}:\d{2}/ ;
            //With timezone
            //2015-08-18T18:08:40-0300
            var datePatternB = /\d{4}-?\d{2}-?\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}/ ;

            var rfidDataListCounter = 0;
            rfidDataList.forEach(function(rfid){

                var obj = {};
                obj.rfidCode = rfid.identificationcode;

                if(rfid.datetime){
                    if(rfid.datetime.length === 19){
                        // Should be like '2015-08-18T18:08:40'
                        // Will be assumed to be the same time of the server.

                        if(!datePatternA.test(rfid.datetime) || isNaN(new Date(rfid.datetime))){
                            //Does not match '2015-08-18T18:08:40-0300' requirements.
                            //cannot build a date object from the validated string.
                            var dateError = {
                                originalDateString: rfid.datetime,
                                parsedDateString: tmpDateString,
                                message: 'Can not build a Date object from the given date string: INVALID DATE.'
                            }
                            logger.warn(dateError);
                            return loopDone(dateError);
                        }
                        // FIXING THE TIMEZONE
                        // If the 'rfid.datetime' is like '2015-08-22T18:08:40' the object will look like this after the fix: Sat Aug 22 2015 18:08:40 GMT-0300 (BRT)
                        var dateFix = new Date(rfid.datetime);
                        dateFix.setTime(dateFix.getTime() + (dateFix.getTimezoneOffset() * 60 * 1000 ) );

                        // DATE OK
                        obj.rfidReadDate = dateFix;

                    }else if(rfid.datetime.length === 24){
                        // Should be like '2015-08-18T18:08:40-0300'
                        if(!datePatternB.test(rfid.datetime) || isNaN(new Date(rfid.datetime))){
                            //Does not match '2015-08-18T18:08:40-0300' requirements.
                            //cannot build a date object from the validated string.
                            var dateError = {
                                originalDateString: rfid.datetime,
                                message: 'Can not build a Date object from the given date string: INVALID DATE.'
                            }
                            logger.warn(dateError);
                            return loopDone(dateError);
                        }
                        // DATE OK
                        obj.rfidReadDate = rfid.datetime;

                    }else {
                        //invalid date string

                        var dateError = {
                            originalDateString: rfid.datetime,
                            message: 'Can not build a Date object from the given date string: TOO LONG OR TOO SHORT STRING.'
                        }
                        logger.warn(dateError);
                        return loopDone(dateError);
                    }
                }else{
                    //invalid date object

                    var dateError = {
                        message: 'Can not build a Date object from the given date string: EMPTY/UNDEFINED STRING'
                    }
                    logger.warn(dateError);
                    return loopDone(dateError);
                }


                obj.serverReceivedDate = new Date();
                obj.collectorId = collector.id;
                obj.packageId = newPk.id;
                return RfidModel.create(obj, {transaction:t})
                .then(function(newDoc){
                    return loopDone();
                })
                .catch(function(err){
                    return loopDone(err);
                });
            });


        })
        .catch(function(e){

            t.rollback();

            if(e.name === "SequelizeUniqueConstraintError" && e.fields['packageHash']){
                logger.debug("Package already on database");
                return callback(null, {hash: rfiddata.md5diggest, size: pack.packageSize, repeated: true});
            }
            logger.error('Error insertSummary package: ' + e.toString());
            return callback(e);
        });

    }).catch(function(e){
        logger.error("insertSummary transaction error " + e);
        return callback(e);
    });

};

/**
 * Overwritten function. Persists a rfiddata packet, but checks before for the collector. If it
 * does not exist create it.
 * @param  {Array}   rfiddata  is the packet, structured as the protocol defines.
 * @param  {Function} callback  callback for when done, passing the first parameter
 * as error and the second a object containing the packet hash, its size and if it is new or a duplicated.
 * @return {void}
 * @memberof ModelControllers
 */

Rfid.save = function(rfiddata, callback){
    var cole = {
        macaddress: rfiddata.macaddress,
        name: rfiddata.name
    };

    CollectorCtrl.findOrCreate(cole, function(collector){
        if(collector.then){
            collector.then(function(c){
                return insertSummary(rfiddata.datasummary, c, callback);
            },
            function(err){
                return callback(err.error, {hash : rfiddata.datasummary.md5diggest});
            });
        }else{
            return insertSummary(rfiddata.datasummary, collector, callback);
        }
    });
}

/**
 * New function. Handles an array of packets for persistence.
 * @param  {Array}   packageArray Is the array of packets
 * @param  {Function} callback     callback for when done.
 * @return {void}
 * @memberof ModelControllers
 */
Rfid.importBulkSave = function(packageArray, callback){

    var rfidImport = {
        receivedPackages : packageArray.length,
        processedPackages : 0,
        receivedRfids : 0,
        insertedPackages : 0,
        insertedRfids : 0,
        discardedByRepetitionPackagesNumber : 0,
        discardedByRepetitionPackagesList : null,
        discardedByErrorPackagesNumber : 0,
        discardedByErrorPackagesList : null
    };

    if(rfidImport.receivedPackages === 0){
        return errorHandler('The data packageArray is empty.', 400, callback);
    }

    packageArray.forEach(function(pack) {
        rfidImport.receivedRfids += pack.datasummary.data.length;

        Rfid.save(pack, function(err, result) {
            rfidImport.processedPackages++;

            if(err){
                rfidImport.discardedByErrorPackagesNumber++;
                if(!rfidImport.discardedByErrorPackagesList){
                    rfidImport.discardedByErrorPackagesList = [];
                }
                rfidImport.discardedByErrorPackagesList.push({hash: result.hash, error: err.toString()});
            }else{
                if(result.new){
                    // the package is new on database.
                    rfidImport.insertedPackages++;
                    rfidImport.insertedRfids += result.size;
                }else if(result.repeated){
                    // the package is reapeated, because already was on database.
                    rfidImport.discardedByRepetitionPackagesNumber++;

                    if(rfidImport.discardedByRepetitionPackagesList === null)
                    rfidImport.discardedByRepetitionPackagesList = [];

                    rfidImport.discardedByRepetitionPackagesList.push(result.hash);
                }else{
                    return errorHandler('save result object not correctly described.', 500, callback);
                }
            }
            if(rfidImport.processedPackages === rfidImport.receivedPackages){
                var returningError = rfidImport.discardedByErrorPackagesList ?  rfidImport.discardedByErrorPackagesList : null;
                return callback(returningError, rfidImport);
            }

        });

    });
}

/**
 * New function. Used for manual rfiddata upload by the web interface. Receives the exported file from a collector.
 * @param  {Array}   packageArray    is the array of packets for insertion. Refers to the exported file content.
 * @param  {String}   platformMediaId the system's reference for the uploaded file.
 * @param  {Function} callback        callback for when done.
 * @return {void}
 * @memberof ModelControllers
 */
Rfid.manualImport = function(packageArray, platformMediaId, callback){

    Rfid.importBulkSave(packageArray, function(err, result){
        var rfidImport = RfidImport.build({
            fileId : platformMediaId,
            serverReceivedDate : new Date()
        });

        rfidImport.save()
        .then(function(savedObj){
            callback(null, result);
        })
        .catch(function(err){
            logger.error(err);
            callback(err);
        });
    });
}

module.exports = Rfid;

/* RFIDDATA OBJ
{
"datasummary": {
"data": [
{
"applicationcode": 0,
"datetime": "2014-10-15T15:58:33",
"id": 1282,
"idantena": 1,
"idcollectorpoint": 100,
"identificationcode": 44332211
}
],
"idbegin": -1273252204,
"idend": -1273254596,
"md5diggest": "f9b0941547b464689121e9e80266fde2"
},
"id": 100,
"macaddress": "B8:27:EB:BB:0C:70",
"name": "Celtab-Serial"
}
*/

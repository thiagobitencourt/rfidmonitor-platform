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
var Controller = require(__base + 'controller/basemodelctrl');
var errorHandler = require(__base + 'utils/errorhandler');
var collectorPool = require(__base + 'controller/collector/collectorpool');

var CollectorModel = sequelize.model('Collector');
var CollectorCtrl = new Controller(CollectorModel, 'collectors');
var Group = sequelize.model('Group');

var insertingMap = {};
CollectorCtrl.oldSave = CollectorCtrl.save;
CollectorCtrl.custom['find'] = function(id, query, callback){
  CollectorCtrl.find(id, query, function(err, collectors){
    if(err)
      return callback(err);

    var response = {};
    if(Array.isArray(collectors)){
      response = [];
      collectors.forEach(function(collector){
        var c = collector.get({plain: true});
        c.status = collectorPool.getStatusByMac(collector.mac);
        response.push(c);
      });
    }else{
      if(collectors){
        response = collectors.get({plain: true});
        response.status = collectorPool.getStatusByMac(collectors.mac);
      }else{
        //If no collector is found, return with error code and messages
        response = {error: 'Error on Collectors', code: 404, message: 'ID not found'};
        return callback(response);
      }
    }
    return callback(null, response);
  });
};

CollectorCtrl.promiseSave = function(newCollector, callback){
    var promise = insertingMap[newCollector.mac];
    if(promise){
      return callback(promise);
    }

    var deferred = q.defer();
    insertingMap[newCollector.mac] = deferred.promise;
    callback(deferred.promise);
    var afterSave = function(err, collector){
      if(err){
        logger.error('Error aqui: ' + JSON.stringify(err));
        deferred.reject(err);
      }else{
        logger.debug("Collector inserted. new ID: " + collector.id);
        var c = collector.get({plain: true});
        collectorPool.push(c);
        deferred.resolve(c);
      }
    }

    if(newCollector.groupId){
      CollectorCtrl.oldSave(newCollector, afterSave);
    }else{
      Group.findOne({where: {isDefault: true, deletedAt: null}})
      .then(function(group){
        if(group){
          newCollector.groupId = group.id;
          return CollectorCtrl.oldSave(newCollector, afterSave);
        }else{
          throw new Error('Default Group not found when it should be');
        }
      })
      .catch(function(e){
        logger.error(e);
        return afterSave(e);
      });
    }
};

CollectorCtrl.findOrCreate = function(collector, callback){
  CollectorCtrl.find(null, {where: {mac:collector.macaddress, deletedAt: null}},
    function(err, collectorResult){
      if(err)
        return callback(collectorResult);

      if(collectorResult.length === 0){
        collector.name = (!!collector.name)? collector.name : 'Unknown';
        collector.mac = collector.macaddress;
        if(collector.id)
          delete collector.id;
        delete collector.macaddress;
        return CollectorCtrl.promiseSave(collector, callback);
      }else{
        // return callback(null, {then: function(cb){
        //   cb(collectorResult[0].get({plain: true}));
        // }});
        return callback(collectorResult[0].get({plain: true}));
      }
    });
};

module.exports = CollectorCtrl;

'use strict';
var SequelizeClass = require('sequelize');
var sequelize = require(__base + 'controller/database/platformsequelize');
var Collector = require(__base + 'models/collector');
var Package = require(__base + 'models/package');

var model = sequelize.define("Rfiddata", {
  rfidCode:{
    type : SequelizeClass.STRING,
    allowNull : false,
  },
  extraData:{
    type : SequelizeClass.STRING,
    allowNull : true
  },
  rfidReadDate:{
    type: SequelizeClass.DATE,
    allowNull: false
  },
  serverReceivedDate:{
    type: SequelizeClass.DATE,
    allowNull: false
  }
},
{
  paranoid : true,
  freezeTableName: true,
  tableName: 'tb_plat_rfiddata'
});

model.belongsTo(Collector, {foreignKey: {name: 'collectorId', allowNull: false}});
model.belongsTo(Package, {foreignKey: {name: 'packageId', allowNull: false}});
module.exports = model;

//OBJECT EXAMPLE
/*
{
 // Goes here
}
*/

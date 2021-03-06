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
var util = require('util');

/**
 * A local application error class, tha inherits from Error.
 * Logs the error thrown and call the super fucntion.
 * @param {String} errorMessage Is the error message.
 * @class
 * @see http://snak.tumblr.com/post/26546869908/creating-your-own-error-class-with-util-inherits
 */
var PlatformError  = function(errorMessage){
	logger.error("Throwing error: " + errorMessage);
	return PlatformError.super_.call(this, errorMessage);
}

util.inherits(PlatformError, Error);
module.exports = PlatformError;

/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"dccs/ui5/costgroups/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});

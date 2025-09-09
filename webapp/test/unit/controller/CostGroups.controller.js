/*global QUnit*/

sap.ui.define([
	"dccs/ui5/costgroups/controller/CostGroups.controller"
], function (Controller) {
	"use strict";

	QUnit.module("CostGroups Controller");

	QUnit.test("I should test the CostGroups controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});

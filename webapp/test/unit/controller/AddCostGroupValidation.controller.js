sap.ui.define([
    "dccs/ui5/costgroups/controller/AddCostGroup.controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/message/Message",
    "sap/ui/core/MessageType"
], function (AddCostGroupController, JSONModel, Message, MessageType) {
    "use strict";

    QUnit.module("AddCostGroup Controller Validation", {
        beforeEach: function () {
            this.oController = new AddCostGroupController();
            var oView = new sap.ui.core.mvc.XMLView();
            var oViewModel = new JSONModel({});
            var oMessageManager = sap.ui.getCore().getMessageManager();
            var oMessageModel = oMessageManager.getMessageModel();

            var aInputs = {
                "nameGermanInput": new sap.m.Input({id: "nameGermanInput"}),
                "infoTextGermanInput": new sap.m.Input({id: "infoTextGermanInput"}),
                "nameEnglishInput": new sap.m.Input({id: "nameEnglishInput"}),
                "infoTextEnglishInput": new sap.m.Input({id: "infoTextEnglishInput"}),
                "sortOrderInput": new sap.m.Input({id: "sortOrderInput"}),
                "costGroupTypeSelect": new sap.m.Select({id: "costGroupTypeSelect"}),
                "circumstanceTable": new sap.m.Table({id: "circumstanceTable"})
            };

            var aLabels = {
                "nameGermanLabel": new sap.m.Label({id: "nameGermanLabel", text: "Designation (German)"}),
                "infoTextGermanLabel": new sap.m.Label({id: "infoTextGermanLabel", text: "Info Text (German)"}),
                "nameEnglishLabel": new sap.m.Label({id: "nameEnglishLabel", text: "Designation (English)"}),
                "infoTextEnglishLabel": new sap.m.Label({id: "infoTextEnglishLabel", text: "Info Text (English)"}),
                "sortOrderLabel": new sap.m.Label({id: "sortOrderLabel", text: "Sort Order"}),
                "costGroupTypeLabel": new sap.m.Label({id: "costGroupTypeLabel", text: "Cost Group Type"})
            };

            oView.setModel(oViewModel, "viewModel");
            oView.setModel(oMessageModel, "message");

            this.oController.getView = function () {
                return {
                    getModel: function (sName) {
                        if (sName === "viewModel") return oViewModel;
                        if (sName === "message") return oMessageModel;
                    },
                    byId: function (sId) {
                        if (aInputs[sId]) return aInputs[sId];
                        if (aLabels[sId]) return aLabels[sId];
                        return null;
                    }
                };
            };

            oMessageManager.registerObject(oView, true);
        },
        afterEach: function () {
            this.oController.destroy();
            sap.ui.getCore().getMessageManager().removeAllMessages();
        }
    });

    QUnit.test("Validation should pass with all fields filled correctly", function (assert) {
        var oViewModel = this.oController.getView().getModel("viewModel");
        oViewModel.setProperty("/nameGerman", "Test");
        oViewModel.setProperty("/infoTextGerman", "Test Info");
        oViewModel.setProperty("/nameEnglish", "Test");
        oViewModel.setProperty("/infoTextEnglish", "Test Info");
        oViewModel.setProperty("/sortOrder", "10");
        oViewModel.setProperty("/costGroupType", "TYPE1");

        var oTable = this.oController.getView().byId("circumstanceTable");
        oTable.addItem(new sap.m.ColumnListItem({
            cells: [
                new sap.m.Input(),
                new sap.m.Input(),
                new sap.m.Input({value: "50"}),
                new sap.m.DatePicker({dateValue: new Date(2023, 0, 1)}),
                new sap.m.DatePicker({dateValue: new Date(2023, 0, 2)})
            ]
        }));

        var bValid = this.oController._validateInputs();
        assert.ok(bValid, "Validation passed");
    });

    QUnit.test("Validation should fail if a required field is empty", function (assert) {
        var oViewModel = this.oController.getView().getModel("viewModel");
        oViewModel.setProperty("/nameGerman", ""); // Empty required field

        var bValid = this.oController._validateInputs();
        assert.notOk(bValid, "Validation failed for empty required field");

        var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
        assert.strictEqual(aMessages.length, 1, "One message generated");
        assert.strictEqual(aMessages[0].getType(), MessageType.Error, "Message is of type Error");
    });

    QUnit.test("Validation should fail for invalid Tax Share", function (assert) {
        var oViewModel = this.oController.getView().getModel("viewModel");
        oViewModel.setProperty("/nameGerman", "Test");
        oViewModel.setProperty("/infoTextGerman", "Test Info");
        oViewModel.setProperty("/nameEnglish", "Test");
        oViewModel.setProperty("/infoTextEnglish", "Test Info");
        oViewModel.setProperty("/sortOrder", "10");
        oViewModel.setProperty("/costGroupType", "TYPE1");

        var oTable = this.oController.getView().byId("circumstanceTable");
        oTable.addItem(new sap.m.ColumnListItem({
            cells: [
                new sap.m.Input(),
                new sap.m.Input(),
                new sap.m.Input({value: "150"}), // Invalid tax share
                new sap.m.DatePicker({dateValue: new Date(2023, 0, 1)}),
                new sap.m.DatePicker({dateValue: new Date(2023, 0, 2)})
            ]
        }));

        var bValid = this.oController._validateInputs();
        assert.notOk(bValid, "Validation failed for invalid tax share");

        var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
        assert.strictEqual(aMessages.length, 1, "One message generated for tax share");
        assert.ok(aMessages[0].getMessage().includes("Tax Share must be between 0 and 100"), "Correct message for tax share");
    });

    QUnit.test("Validation should fail for invalid date range", function (assert) {
        var oViewModel = this.oController.getView().getModel("viewModel");
        oViewModel.setProperty("/nameGerman", "Test");
        oViewModel.setProperty("/infoTextGerman", "Test Info");
        oViewModel.setProperty("/nameEnglish", "Test");
        oViewModel.setProperty("/infoTextEnglish", "Test Info");
        oViewModel.setProperty("/sortOrder", "10");
        oViewModel.setProperty("/costGroupType", "TYPE1");

        var oTable = this.oController.getView().byId("circumstanceTable");
        oTable.addItem(new sap.m.ColumnListItem({
            cells: [
                new sap.m.Input(),
                new sap.m.Input(),
                new sap.m.Input({value: "50"}),
                new sap.m.DatePicker({dateValue: new Date(2023, 0, 2)}),
                new sap.m.DatePicker({dateValue: new Date(2023, 0, 1)}) // Invalid date range
            ]
        }));

        var bValid = this.oController._validateInputs();
        assert.notOk(bValid, "Validation failed for invalid date range");

        var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
        assert.strictEqual(aMessages.length, 1, "One message generated for date range");
        assert.ok(aMessages[0].getMessage().includes("'Valid From' date must be before 'Valid To' date"), "Correct message for date range");
    });
});

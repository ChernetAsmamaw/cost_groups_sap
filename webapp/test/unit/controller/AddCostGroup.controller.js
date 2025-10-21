/*global QUnit*/

sap.ui.define([
    "dccs/ui5/costgroups/controller/AddCostGroup.controller",
    "sap/ui/core/mvc/View",
    "sap/ui/model/json/JSONModel",
    "sap/m/Input",
    "sap/m/TextArea"
], function (Controller, View, JSONModel, Input, TextArea) {
    "use strict";

    QUnit.module("AddCostGroup Controller - Validation Tests", {
        beforeEach: function () {
            this.oController = new Controller();
            
            // Mock view and controls
            this.oView = new View();
            this.oController.getView = function () {
                return this.oView;
            }.bind(this);

            // Create mock controls
            this.oNameGermanInput = new Input("nameGermanInput");
            this.oInfoTextGermanInput = new TextArea("infoTextGermanInput");
            this.oNameEnglishInput = new Input("nameEnglishInput");
            this.oInfoTextEnglishInput = new TextArea("infoTextEnglishInput");
            this.oSortOrderInput = new Input("sortOrderInput");

            // Mock byId method
            this.oController.byId = function (sId) {
                switch (sId) {
                    case "nameGermanInput":
                        return this.oNameGermanInput;
                    case "infoTextGermanInput":
                        return this.oInfoTextGermanInput;
                    case "nameEnglishInput":
                        return this.oNameEnglishInput;
                    case "infoTextEnglishInput":
                        return this.oInfoTextEnglishInput;
                    case "sortOrderInput":
                        return this.oSortOrderInput;
                    default:
                        return null;
                }
            }.bind(this);

            // Mock models
            this.oViewModel = new JSONModel({
                nameGerman: "",
                infoTextGerman: "",
                nameEnglish: "",
                infoTextEnglish: "",
                sortOrder: ""
            });

            this.oView.setModel(this.oViewModel, "viewModel");
            
            // Mock message manager
            this.oController.oMessageManager = {
                removeAllMessages: function () {},
                addMessages: function () {}
            };

            // Initialize controller
            this.oController.onInit();
        },

        afterEach: function () {
            this.oNameGermanInput.destroy();
            this.oInfoTextGermanInput.destroy();
            this.oNameEnglishInput.destroy();
            this.oInfoTextEnglishInput.destroy();
            this.oSortOrderInput.destroy();
            this.oView.destroy();
        }
    });

    QUnit.test("Should validate required fields", function (assert) {
        // Set empty values
        this.oViewModel.setProperty("/nameGerman", "");
        this.oViewModel.setProperty("/infoTextGerman", "");
        this.oViewModel.setProperty("/nameEnglish", "");
        this.oViewModel.setProperty("/infoTextEnglish", "");
        this.oViewModel.setProperty("/sortOrder", "");

        // Test validation
        var bResult = this.oController._validateForm();

        assert.strictEqual(bResult, false, "Validation should fail for empty required fields");
        assert.strictEqual(this.oNameGermanInput.getValueState(), "Error", "German name input should be in error state");
        assert.strictEqual(this.oInfoTextGermanInput.getValueState(), "Error", "German info text should be in error state");
        assert.strictEqual(this.oNameEnglishInput.getValueState(), "Error", "English name input should be in error state");
        assert.strictEqual(this.oInfoTextEnglishInput.getValueState(), "Error", "English info text should be in error state");
        assert.strictEqual(this.oSortOrderInput.getValueState(), "Error", "Sort order input should be in error state");
    });

    QUnit.test("Should validate field lengths", function (assert) {
        // Set values that are too short
        this.oViewModel.setProperty("/nameGerman", "A"); // Too short (min 2)
        this.oViewModel.setProperty("/infoTextGerman", "ABC"); // Too short (min 5)
        this.oViewModel.setProperty("/nameEnglish", "B"); // Too short (min 2)
        this.oViewModel.setProperty("/infoTextEnglish", "DEF"); // Too short (min 5)
        this.oViewModel.setProperty("/sortOrder", "1"); // Valid

        var bResult = this.oController._validateForm();

        assert.strictEqual(bResult, false, "Validation should fail for fields that are too short");
        assert.strictEqual(this.oNameGermanInput.getValueState(), "Error", "German name input should be in error state for short text");
        assert.strictEqual(this.oInfoTextGermanInput.getValueState(), "Error", "German info text should be in error state for short text");
    });

    QUnit.test("Should validate field patterns", function (assert) {
        // Set invalid characters for names
        this.oViewModel.setProperty("/nameGerman", "Test@#$"); // Invalid characters
        this.oViewModel.setProperty("/infoTextGerman", "Valid German info text");
        this.oViewModel.setProperty("/nameEnglish", "Test@#$"); // Invalid characters
        this.oViewModel.setProperty("/infoTextEnglish", "Valid English info text");
        this.oViewModel.setProperty("/sortOrder", "1");

        var bResult = this.oController._validateForm();

        assert.strictEqual(bResult, false, "Validation should fail for invalid characters in names");
        assert.strictEqual(this.oNameGermanInput.getValueState(), "Error", "German name input should be in error state for invalid characters");
        assert.strictEqual(this.oNameEnglishInput.getValueState(), "Error", "English name input should be in error state for invalid characters");
    });

    QUnit.test("Should validate numeric fields", function (assert) {
        // Set valid text fields but invalid sort order
        this.oViewModel.setProperty("/nameGerman", "Test German");
        this.oViewModel.setProperty("/infoTextGerman", "Valid German info text");
        this.oViewModel.setProperty("/nameEnglish", "Test English");
        this.oViewModel.setProperty("/infoTextEnglish", "Valid English info text");
        this.oViewModel.setProperty("/sortOrder", "abc"); // Invalid number

        var bResult = this.oController._validateForm();

        assert.strictEqual(bResult, false, "Validation should fail for invalid numeric value");
        assert.strictEqual(this.oSortOrderInput.getValueState(), "Error", "Sort order input should be in error state for non-numeric value");
    });

    QUnit.test("Should validate numeric ranges", function (assert) {
        // Set valid text fields but out-of-range sort order
        this.oViewModel.setProperty("/nameGerman", "Test German");
        this.oViewModel.setProperty("/infoTextGerman", "Valid German info text");
        this.oViewModel.setProperty("/nameEnglish", "Test English");
        this.oViewModel.setProperty("/infoTextEnglish", "Valid English info text");
        this.oViewModel.setProperty("/sortOrder", "10000"); // Above max (9999)

        var bResult = this.oController._validateForm();

        assert.strictEqual(bResult, false, "Validation should fail for out-of-range numeric value");
        assert.strictEqual(this.oSortOrderInput.getValueState(), "Error", "Sort order input should be in error state for value above max");
    });

    QUnit.test("Should pass validation with valid data", function (assert) {
        // Set all valid values
        this.oViewModel.setProperty("/nameGerman", "Test German Name");
        this.oViewModel.setProperty("/infoTextGerman", "Valid German info text with sufficient length");
        this.oViewModel.setProperty("/nameEnglish", "Test English Name");
        this.oViewModel.setProperty("/infoTextEnglish", "Valid English info text with sufficient length");
        this.oViewModel.setProperty("/sortOrder", "100");

        var bResult = this.oController._validateForm();

        assert.strictEqual(bResult, true, "Validation should pass for all valid fields");
        assert.strictEqual(this.oNameGermanInput.getValueState(), "None", "German name input should not be in error state");
        assert.strictEqual(this.oInfoTextGermanInput.getValueState(), "None", "German info text should not be in error state");
        assert.strictEqual(this.oNameEnglishInput.getValueState(), "None", "English name input should not be in error state");
        assert.strictEqual(this.oInfoTextEnglishInput.getValueState(), "None", "English info text should not be in error state");
        assert.strictEqual(this.oSortOrderInput.getValueState(), "None", "Sort order input should not be in error state");
    });

    QUnit.test("Should get validation rules for controls", function (assert) {
        var oRules = this.oController._getValidationRulesForControl("nameGermanInput");
        
        assert.ok(oRules, "Should return validation rules for German name input");
        assert.strictEqual(oRules.required, true, "German name should be required");
        assert.strictEqual(oRules.minLength, 2, "German name should have minimum length of 2");
        assert.strictEqual(oRules.maxLength, 50, "German name should have maximum length of 50");
        assert.ok(oRules.pattern, "German name should have a pattern validation");

        var oSortOrderRules = this.oController._getValidationRulesForControl("sortOrderInput");
        assert.strictEqual(oSortOrderRules.type, "number", "Sort order should be validated as number");
        assert.strictEqual(oSortOrderRules.min, 1, "Sort order should have minimum value of 1");
        assert.strictEqual(oSortOrderRules.max, 9999, "Sort order should have maximum value of 9999");
    });

    QUnit.test("Should clear validation states", function (assert) {
        // Set error states
        this.oNameGermanInput.setValueState("Error");
        this.oInfoTextGermanInput.setValueState("Error");
        this.oNameEnglishInput.setValueState("Error");
        this.oInfoTextEnglishInput.setValueState("Error");
        this.oSortOrderInput.setValueState("Error");

        // Clear validation states
        this.oController._clearValidationStates();

        assert.strictEqual(this.oNameGermanInput.getValueState(), "None", "German name input state should be cleared");
        assert.strictEqual(this.oInfoTextGermanInput.getValueState(), "None", "German info text state should be cleared");
        assert.strictEqual(this.oNameEnglishInput.getValueState(), "None", "English name input state should be cleared");
        assert.strictEqual(this.oInfoTextEnglishInput.getValueState(), "None", "English info text state should be cleared");
        assert.strictEqual(this.oSortOrderInput.getValueState(), "None", "Sort order input state should be cleared");
    });

});
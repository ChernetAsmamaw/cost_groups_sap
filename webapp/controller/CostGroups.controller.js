sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], function (Controller, JSONModel, MessageToast, Filter, FilterOperator, MessageBox, Fragment) {
    "use strict";

    return Controller.extend("dccs.ui5.costgroups.controller.CostGroups", {

        onInit: function () {
            const oViewModel = new JSONModel({
                totalEntries: 0,
                busy: true, // Start busy until data is received
                selectedCount: 0,
                isFilterBarVisible: true
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Load helper data first. The table binding will wait for dataReceived.
            this._loadCostGroupTypes().catch((err) => {
                // Display error only if type loading fails
                MessageBox.error("Failed to load initial data (Cost Group Types). Please try again later.");
                oViewModel.setProperty("/busy", false); // Unset busy on error
            });

            const oRouter = this.getOwnerComponent().getRouter();
            // Note: RouteCostGroupDetail is typically handled by the detail controller, but keeping
            // it here doesn't hurt if the router is defined this way.
            oRouter.getRoute("RouteCostGroupDetail").attachPatternMatched(this._onObjectMatched, this);
            
            this._filterDebounceTimer = null;
            this._bDataReceivedAttached = false;
        },

        /**
         * Use onAfterRendering to safely access view bindings and attach the dataReceived handler.
         * This ensures the table only stops being busy after data has loaded.
         */
        onAfterRendering: function() {
            if (!this._bDataReceivedAttached) {
                const oTable = this.byId("costGroupsTable");
                // Ensure the table is present and has items binding
                const oBinding = oTable ? oTable.getBinding("items") : null;

                if (oBinding) {
                    oBinding.attachDataReceived(this.onDataReceived, this);
                    oBinding.resume(); // Ensure data load starts
                    this._bDataReceivedAttached = true; 
                }
            }
        },

        /**
         * Loads the Cost Group Type descriptions into a separate JSON model.
         * FIX: Ensure keys are stored as trimmed strings.
         * @returns {Promise} A promise that resolves when the data is loaded.
         */
        _loadCostGroupTypes: function() {
            return new Promise((resolve, reject) => {
                const oCostGroupTypesModel = new JSONModel();
                this.getView().setModel(oCostGroupTypesModel, "costGroupTypes");
                const oCgrtyModel = this.getOwnerComponent().getModel("xdccsxcng_cgrty");

                if (!oCgrtyModel) {
                    MessageToast.show("Cost Group Type service model not found.");
                    return reject();
                }

                oCgrtyModel.read("/xdccsxcng_cgrty", {
                    success: (oData) => {
                        const oCostGroupTypesMap = oData.results.reduce((acc, oType) => {
                            // FIX: Convert key to a string and trim spaces to ensure consistency
                            const sKey = String(oType.cost_grp_type).trim(); 
                            acc[sKey] = oType.costgrptype_text;
                            return acc;
                        }, {});
                        oCostGroupTypesModel.setData(oCostGroupTypesMap);
                        resolve();
                    },
                    error: (oError) => {
                        MessageToast.show("Error loading Cost Group Types.");
                        reject(oError);
                    }
                });
            });
        },

        /**
         * Formatter to convert Cost Group Type ID to Text.
         * FIX: Ensure the input ID is converted to a trimmed string for a reliable lookup.
         * The framework will re-evaluate this when the 'costGroupTypes' model is loaded.
         * @param {string} sCostGrpTypeNo The ID of the cost group type (e.g., '01', '02').
         * @returns {string} The corresponding text or the ID if not found.
         */
        formatCostGroupType: function(sCostGrpTypeNo) {
            if (sCostGrpTypeNo === undefined || sCostGrpTypeNo === null) return "";
            
            // Convert input to a string and trim spaces for a reliable lookup key
            const sKey = String(sCostGrpTypeNo).trim(); 
            
            // Check if the 'costGroupTypes' model exists and has data
            const oCostGroupTypesModel = this.getView().getModel("costGroupTypes");
            if (!oCostGroupTypesModel) {
                return sCostGrpTypeNo; // Return ID if model isn't ready
            }
            
            const oCostGroupTypes = oCostGroupTypesModel.getData();
            if (Object.keys(oCostGroupTypes).length === 0) {
                 return sCostGrpTypeNo; // Return ID if data hasn't loaded yet
            }
            
            // Look up using the consistent string key. If lookup fails, return the original input.
            return oCostGroupTypes[sKey] || sCostGrpTypeNo; 
        },
        
        /**
         * Handles the data received event to update the entry count and unset busy state.
         */
        onDataReceived: function (oEvent) {
            const oBinding = oEvent.getSource();
            // Use total length if available, otherwise fallback to current length.
            const iLength = oBinding.getLength ? oBinding.getLength() : oBinding.getCurrentContexts().length; 
            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/totalEntries", iLength);
            oViewModel.setProperty("/busy", false); // Data is loaded, stop busy indicator
        },
        
        /**
         * Fully functional frontend filter with debouncing.
         */
        onFilterChange: function () {
            clearTimeout(this._filterDebounceTimer);

            this._filterDebounceTimer = setTimeout(() => {
                const sCostGroup = this.byId("costGroupInput").getValue();
                const sDescription = this.byId("descInput").getValue();
                const aFilters = [];

                if (sCostGroup) {
                    aFilters.push(new Filter("CostGrpName", FilterOperator.Contains, sCostGroup));
                }
                if (sDescription) {
                    aFilters.push(new Filter("CostGrpInfoTxt", FilterOperator.Contains, sDescription));
                }
                
                const oTable = this.byId("costGroupsTable");
                const oBinding = oTable ? oTable.getBinding("items") : null;
                
                if(oBinding) {
                    oBinding.filter(aFilters);
                    this.getView().getModel("viewModel").setProperty("/busy", true); // Set busy during filter execution
                } else {
                    MessageToast.show(this._getText("tableNotReady"));
                }
            }, 300); // 300ms delay
        },

        onSelectionChange: function (oEvent) {
            const iSelectedCount = this.byId("costGroupsTable").getSelectedItems().length;
            this.getView().getModel("viewModel").setProperty("/selectedCount", iSelectedCount);
        },

        onGroupDeletePress: function () {
            const aSelectedItems = this.byId("costGroupsTable").getSelectedItems();
            if (aSelectedItems.length === 0) {
                MessageToast.show(this._getText("noItemsSelected"));
                return;
            }

            MessageBox.confirm(
                this._getText("confirmGroupDeletion", [aSelectedItems.length]), {
                    title: this._getText("confirmDeletionTitle"),
                    onClose: (oAction) => {
                        if (oAction === MessageBox.Action.OK) {
                            this._executeGroupDeletion(aSelectedItems);
                        }
                    }
                }
            );
        },

        _executeGroupDeletion: function (aSelectedItems) {
            const oModel = this.getView().getModel();
            const aPromises = [];
            this.getView().getModel("viewModel").setProperty("/busy", true);

            aSelectedItems.forEach(oItem => {
                const sPath = oItem.getBindingContext().getPath();
                const oPromise = new Promise((resolve, reject) => {
                    oModel.remove(sPath, {
                        success: resolve,
                        error: reject
                    });
                });
                aPromises.push(oPromise);
            });
            
            Promise.allSettled(aPromises).then(results => {
                const iSuccessCount = results.filter(r => r.status === "fulfilled").length;
                const iFailedCount = results.length - iSuccessCount;
                
                if (iFailedCount === 0) {
                    MessageToast.show(this._getText("successGroupDelete", [iSuccessCount]));
                } else {
                    MessageBox.error(this._getText("errorPartialGroupDelete", [iSuccessCount, results.length]));
                }
                this._refreshTableData();
            });
        },
        
        onDeleteCostGroup: function (oEvent) {
            // Stop the row navigation event from firing
            oEvent.stopPropagation(); 
            
            const oContext = oEvent.getSource().getBindingContext();
            const oData = oContext.getObject();

            MessageBox.confirm(
                this._getText("confirmSingleDeletion", [oData.CostGrpName]), {
                    title: this._getText("confirmDeletionTitle"),
                    onClose: (oAction) => {
                        if (oAction === MessageBox.Action.OK) {
                            this._deleteCostGroup(oContext.getPath(), oData.CostGrpName);
                        }
                    }
                }
            );
        },

        _deleteCostGroup: function (sPath, sName) {
            const oModel = this.getView().getModel();
            this.getView().getModel("viewModel").setProperty("/busy", true);

            oModel.remove(sPath, {
                success: () => {
                    MessageToast.show(this._getText("successSingleDelete", [sName]));
                    this._refreshTableData();
                },
                error: (oError) => {
                    this.getView().getModel("viewModel").setProperty("/busy", false);
                    // No need for manual parsing, OData V2 model handles messages.
                    MessageBox.error(this._getText("errorSingleDelete", [sName]), {
                        details: JSON.stringify(oError, null, 2)
                    });
                }
            });
        },

        _refreshTableData: function() {
            const oTable = this.byId("costGroupsTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
                oTable.removeSelections(true);
            }
            this.getView().getModel("viewModel").setProperty("/selectedCount", 0);
            this.getView().getModel("viewModel").setProperty("/busy", false);
        },

        _parseError: function (oError) {
            // OData V2 models push their messages to the message manager automatically.
            // Keeping this stub for consistency, though it's not needed for message handling.
        },

        onHideFilter: function () {
            const oFilterBarContent = this.byId("filterBarContent");
            const bIsVisible = oFilterBarContent.getVisible();
            oFilterBarContent.setVisible(!bIsVisible);
            this.byId("hideFilterBtn").setText(bIsVisible ? this._getText("showFilter") : this._getText("hideFilter"));
        },

        onRowPress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            // Guard against navigating if a context is not available
            if (!oContext) {
                MessageToast.show("Could not find the selected item context.");
                return;
            }
            const sCostGroupId = oContext.getProperty("CostGrpId");
            this.getOwnerComponent().getRouter().navTo("RouteCostGroupDetail", {
                costGroupId: sCostGroupId
            });
        },

        onAddCostGroup: function () {
            this.getOwnerComponent().getRouter().navTo("RouteAddCostGroup");
        },

        onLegendPress: function (oEvent) {
            const oView = this.getView();
            if (!this._pLegendPopover) {
                this._pLegendPopover = Fragment.load({
                    name: "dccs.ui5.costgroups.view.LegendPopover",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }
            this._pLegendPopover.then(function (oPopover) {
                oPopover.openBy(oEvent.getSource());
            });
        },
        
        _getText: function (sKey, aArgs) {
            // Check if the i18n model is available before attempting to get the bundle
            const oI18nModel = this.getOwnerComponent().getModel("i18n");
            if (!oI18nModel) {
                return sKey; // Fallback to key if model is missing
            }
            return oI18nModel.getResourceBundle().getText(sKey, aArgs);
        },

        // Stub for router pattern matched event (not strictly needed here but kept from original)
        _onObjectMatched: function() {
            // Placeholder: The detail page navigation is handled by onRowPress.
        }
    });
});
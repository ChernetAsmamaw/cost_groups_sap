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
                busy: true,
                selectedCount: 0,
                isFilterBarVisible: true
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Load Cost Group Types into a separate model for lookups
            this._loadCostGroupTypes().catch((err) => {
                MessageBox.error("Failed to load initial data (Cost Group Types). Please try again later.");
                oViewModel.setProperty("/busy", false) // Unset busy on error
            });

            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteCostGroupDetail").attachPatternMatched(this._onObjectMatched, this);
            
            this._filterDebounceTimer = null;
            this._bDataReceivedAttached = false;
        },

    // Attach dataReceived handler after rendering to manage busy state
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


    // Load Cost Group type descriptions into a JSON model for lookups
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


    // Format Cost Group Type ID into its human readable text
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
        

    // Update view model when table data is received (update counts and busy)
    onDataReceived: function (oEvent) {
            const oBinding = oEvent.getSource();
            // Use total length if available, otherwise fallback to current length.
            const iLength = oBinding.getLength ? oBinding.getLength() : oBinding.getCurrentContexts().length; 
            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/totalEntries", iLength);
            oViewModel.setProperty("/busy", false); // Data is loaded, stop busy indicator
        },
        

    // Handle filter input changes with debouncing and apply filters to table
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

    // Update selected count in view model when table selection changes
    onSelectionChange: function (oEvent) {
            const iSelectedCount = this.byId("costGroupsTable").getSelectedItems().length;
            this.getView().getModel("viewModel").setProperty("/selectedCount", iSelectedCount);
        },

    // Confirm and initiate deletion of selected cost groups
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

    // Execute deletion requests for multiple selected groups and summarize results
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
        
    // Confirm and delete a single cost group row
    onDeleteCostGroup: function (oEvent) {
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

    // Delete a cost group at given OData path and refresh table on success
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

    // Refresh table binding, clear selection and reset viewModel flags
    _refreshTableData: function() {
            const oTable = this.byId("costGroupsTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
                oTable.removeSelections(true);
            }
            this.getView().getModel("viewModel").setProperty("/selectedCount", 0);
            this.getView().getModel("viewModel").setProperty("/busy", false);
        },

        // Parse or handle OData errors (stub - messages handled by message manager)
        _parseError: function (oError) {
        },

    // Toggle visibility of the filter bar and update button text
    onHideFilter: function () {
            const oFilterBarContent = this.byId("filterBarContent");
            const bIsVisible = oFilterBarContent.getVisible();
            oFilterBarContent.setVisible(!bIsVisible);
            this.byId("hideFilterBtn").setText(bIsVisible ? this._getText("showFilter") : this._getText("hideFilter"));
        },

    // Navigate to the Cost Group detail route when a row is pressed
    onRowPress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                MessageToast.show("Could not find the selected item context.");
                return;
            }
            const sCostGroupId = oContext.getProperty("CostGrpId");
            this.getOwnerComponent().getRouter().navTo("RouteCostGroupDetail", {
                costGroupId: sCostGroupId
            });
        },

        // Navigate to the Add Cost Group route
        onAddCostGroup: function () {
            this.getOwnerComponent().getRouter().navTo("RouteAddCostGroup");
        },

    // Open the legend popover (shared fragment)
    onLegendPress: function (oEvent) {
            const oButton = oEvent.getSource();
            const oView = this.getView();
            if (!this._pLegendPopover) {
                this._pLegendPopover = Fragment.load({
                    id: oView.getId(),
                    name: "dccs.ui5.costgroups.view.LegendPopover",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }
            this._pLegendPopover.then(function (oPopover) {
                oPopover.openBy(oButton);
            });
        },
        
        // Retrieve translated text from i18n model with optional formatting arguments
        _getText: function (sKey, aArgs) {
            const oI18nModel = this.getOwnerComponent().getModel("i18n");
            if (!oI18nModel) {
                return sKey;
            }
            return oI18nModel.getResourceBundle().getText(sKey, aArgs);
        },

        // Router pattern matched stub (kept for compatibility with routing setup)
        _onObjectMatched: function() {
            // The detail page navigation is handled by onRowPress.
        }
    });
});
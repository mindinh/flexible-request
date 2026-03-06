using {sap.cre as db} from '../db/schema';

/**
 * Service for Process Owners / Administrators.
 */
service AdminService @(
    path    : '/admin',
    requires: 'admin'
) {

    @restrict              : [{
        grant: '*',
        to   : 'admin'
    }]
    @odata.draft.enabled
    @cds.redirection.target: true
    entity RequestTypes      as
        projection on db.RequestTypes {
            *,
            steps : redirected to StepDefinitions
        }
        actions {
            action clone()        returns RequestTypes;
            action discardDraft() returns RequestTypes;
        };

    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity StepDefinitions   as
        projection on db.StepDefinitions {
            *,
            virtual null as ownerDisplayName : String,
            approverRules                    : redirected to ApproverRules
        };

    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity StepDependencies  as projection on db.StepDependencies;

    // SchemaDefinitions removed - schemaContent is now stored directly on StepDefinitions

    // Phase 2: Status Network and Approver Rules
    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity StatusNetwork     as projection on db.StatusNetwork;

    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity ApproverRules     as
        projection on db.ApproverRules {
            *,
            virtual null as principalDisplayName : String
        };

    // === API Integrations ===
    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity ApiConnections    as projection on db.ApiConnections;

    // === Identity Management (Epic 1.3) ===

    // Principal Types configuration (enable/disable types)
    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity SupportTypes      as projection on db.SupportTypes;

    // Group management (Teams, Departments, Roles)
    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity ShadowGroups      as projection on db.ShadowGroups;

    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity GroupMembers      as projection on db.GroupMembers;

    // Users (read-only - populated via JIT)
    @readonly
    entity ShadowUsers       as projection on db.ShadowUsers;

    // SAML Group Mappings (auto-assign users based on IDP claims)
    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity SamlGroupMappings as projection on db.SamlGroupMappings;

    // Organization Hierarchies
    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity OrgHierarchies    as projection on db.OrgHierarchies;

    // === System Settings: Number Ranges ===
    @restrict: [{
        grant: '*',
        to   : 'admin'
    }]
    entity NumberRanges      as
        projection on db.NumberRanges {
            *,
            requestType : redirected to RequestTypes
        }
        actions {
            // Reset the counter back to startNumber
            action resetRange();
        };
}

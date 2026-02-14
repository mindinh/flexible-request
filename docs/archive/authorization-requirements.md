# Roles and Authorization Concepts

## 1. Admin

We have of course the role admin - who will responsible for maintain the Request Type in Studio

## 2. Requester Or Request Coordinator

This is the one who actually raise the Request (in classical workflow) or raise and coordinate the Request (in goverance workflow)

Requester Or Request Coordinator: sometime is one person, and most of the time is the person how create the request, but sometime can be the other person, or the group of person (example: TEAM, GROUP, DEPARTMENT ..)

The Requester Or Request Coordinator can do:

- create new request

- maintain all requests which created or coordinated by him. Maintain here means: input data and submit data or answer the clarification (not mean approve or reject or sendback)

- maintain all steps which belong to the requests which created or coordinated by him

- see other requests and steps which created or coordinated by someone else

## 3. Step Owner or Step Responsbile

This is the one who will responsbile to input data for the step and submit the step for further approval

"Step Owner or Step Responsbile" can be the same with "Requester Or Request Coordinator" but can be different.

By default they are same, during the creation time of the Request, the "Requester Or Request Coordinator" can define who is the "Step Owner or Step Responsbile" for each step in the request

Similar like "Requester Or Request Coordinator", the Step Owner or Step Responsbile can also be a group of person (example: TEAM, GROUP, DEPARTMENT ..)

The "Step Owner or Step Responsbile" can do:

- maintain the step data which assign to him. Maintain here means: input data and submit data or answer the clarification (not mean approve or reject or sendback)

- see other steps data and request data within the current request

- see other requests and steps which created or coordinated by someone else

## 4. Approver or Reviewer

This is the one who will responsible to approve, reject, send back, review … the workflow

Similar this can also be a group of person (example: TEAM, GROUP, DEPARTMENT ..). I think we apply this already, but not sure if it works perfectly, need to check

The "Approver or Reviewer" can do:

- do the actions (approve, reject, send back, review …) for the step which assign to him.

- see other steps data and request data within the current request

- see other requests and steps which created or coordinated by someone else



# User Type concept

Right now we have the "APPROVER_TYPES", however it more or less hard coding in @constants.ts for demo purpose. For production deploy, we need to have the concept for this.

According to the Roles and Authorization concepts, we known that not only Approver can be the group of person, but also the Requester, Step Onwer

I think we need an place to define for example which groups, roles, teams, positions, departments ..etc do we have. Which user belong to these teams, groups, departments.
We should also have the general setting, for example we will support the Group, Team right now (for example) the matrix as following:

| Type      | Supported (yes/no) |
| --------- | ------------------ |
| USER      | yes/no checkbox    |
| GROUP     |                    |
| TEAM      |                    |
| ROLE      |                    |
| DEPARMENT |                    |
| POSITION  |                    |

If the Support Type is Active, during the Request Type defintion, at Approval Rules page, we can select the coresponding Active Support Type. Also during the Request creation, the user can also select the Active support Type and Assign to the Request or the Step (hint: we may need extend our Request and Step table, do we)?

Then we can maintain list of values for each support Type, and the user belong to this support tpye. For example the GROUP, we can maintain with 2 level tables with expandable possible from level 1 to level 2:

| Group Name       | Group Description |                  |            |           |                           |
| ---------------- | ----------------- | ---------------- | ---------- | --------- | ------------------------- |
| finance_approver | Finance Approvers |                  |            |           |                           |
|                  | User ID           | Email            | First Name | Last Name | Unique ID from log-in IDP |
|                  | exampleID1        | hieu@conarum.com | Hieu       | Ngo       | 1unique IDP user UUID     |
|                  | exampleID2        | hieu2@conarum.com| Hieu2      | Ngo2      | 2unique IDP user UUID     |
|                  |                   |                  |            |           |                           |

Similar the Group, we can also have the Team, Role, Department, Position ..etc

For the user, we need to think about how should we maintain, because input the "Unique ID from log-in IDP" is difficult, and how can we determine the user information correctly once user log-in to our system. Basically, we will use the SAP IDP for user login. 



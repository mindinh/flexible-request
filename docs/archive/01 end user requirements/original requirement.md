# Process description

A flexible request system allow end user to raise different kind of business requests:
- requet for purchasing
- request for sourcing
- request for travelling
- request for invoicing
- leave request
- request for new asset like laptop, handy phone, etc
- ...

Also be able to raise request for some governance processes like:
- request for New Plant
- ...

This is quite special case, because it is not a simple request, it is a governance process, a request for new plant could have several steps to be approved, example:
- step 1: Define Plant
- step 2: Assign plant to company code
- step 3: Assign Plant to Default Purchasing Organization
- step 4: Assign Plant to Purchasing Organization
- step 5: Assign Shipping Point to Plant
...

# Approval process

- An Request can contain one or more configurable steps.
- Each step itself a workflow, it can have one or more approvers.
- The object data of each step is different, it depends on the request type and it is configurable
- The object data of each step in the same request maybe different, and may pass to the next step (example: request for new plant may have several steps to be approved, and each step may have different object data, the data from previous step will be passed to the next step)
- The steps with a request can be executed in parallel or in sequence. 
- Step typically will have an Initiator, one or more Approvers.
- The Approvers will be determined dynamically based on the request type and the object data of the step (example: request for plant 1000 will be approved by plant manager, but request for plant 2000 will be approved by plant manager and plant director, etc).
- The Approver could be a person, or a team. 
- NOTE: we may think about using SAP BPA Decision table concept to determine the approvers.

# End user application

1. My Request
   - This application should be able to raise request for different kind of business requests and governance processes.
   - It typically have the worklist page to show all requests raise by user, and the detail page to show the request detail.
   - The detail page should have a form to raise request, and a list of steps to be approved.
   - The sample can be found: [sample 1](sample%201-%20my%20request%20detail%20page.png). NOTE: the sample is not final design, it is just for illustration. NOTE: the design of the request information may fix (like sample 1), but the business object information will dynamic based on the request type and the object data of the step. 

2. Approval Request
   - This application will be used by approvers to approve requests.
   - It typically have the worklist page to show all requests need to be approved, and the detail page to show the request detail.

3. ..

# Admin application

1. Request Type Management
   - This application will be used by admin to manage request types.
   - The design will be the design studio, provide the the "what you see is what you get" experience.
   - Admin can:
        - Define request type
        - Define status network of request type, which status will be the end status of the request type
        - Define the action of the request type (start, conclude, complete, terminate, etc)
        - Define the steps of the request type
        - Define the approvers of the step (maybe using SAP BPA Decision table concept)
        - Define the object data of the step, which data will be passed to the next step
        - Define status network of the step, which status will be the end status of the step
        - Define the execution mode of the step (parallel or in sequence)
        - Define the action of the step (approve, reject, cancel, etc)
        - ...
2. ...
   

   
   
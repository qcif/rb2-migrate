
RDMP permission crosswalk
-------------------------


| *Stash 2.0*  |   |  *Stash 3.0* |   |
|---|---|---|---|
| Owner |view, edit | --- | 
| FNCI | |FNCI | view, edit
| Data manager | | Data manager | view, edit
| Collaborators | | Collaborators | View
| Supervisor | | Supervisor |View
| Other viewers | view | --- | 

Stash 2.0 has two categories of permission-holder which aren’t available
in Stash 3.0. The owner (from the TF_OBJ_META) and other viewers which
have been added in the access permissions tool from the researcher
dashboard.

Migration should report on:

* RDMPs where the S2 Owner is neither FNCI nor Data Manager – because
they are going to lose their ability to see and edit the plan
* RDMPs who have other viewers who aren’t in the Collaborators list

The second of these is much lower priority – if it’s too fiddly to
extract the info from Stash 1.9 we shouldn’t spend too much time on it.

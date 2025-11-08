from workflow_models import WorkflowStatus, WorkflowTransition, WorkflowActionType

def test_workflow_status_validation():
    """Test WorkflowStatus model validates correctly"""
    status = WorkflowStatus(
        current_state="awaiting_procurement",
        current_assignee_role="procurement_manager",
        can_user_act=True,
        available_actions=["submit_procurement", "send_back"],
        transitions=[]
    )

    assert status.current_state == "awaiting_procurement"
    assert "submit_procurement" in status.available_actions

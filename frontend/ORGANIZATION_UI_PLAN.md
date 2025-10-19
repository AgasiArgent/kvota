# Frontend Organization UI Implementation Plan

**Date Created:** October 17, 2025
**Last Updated:** October 17, 2025 13:15 UTC
**Status:** 🚧 In Progress (Phase 2 Complete, Testing Started)
**Backend Status:** ✅ Complete (11/11 tests passing)

---

## Configuration

- **UI Library:** Ant Design (already installed)
- **Language:** Russian
- **Testing:** Incremental (test each feature as built)
- **Team Access:** Owners/Admins only
- **Create Flow:** Stay on list after creating org
- **Priority Order:** Types/API → Create → List/Settings → Switcher → Team

---

## Implementation Priority

### ✅ Phase 1: Foundation
**Status:** ✅ Complete (October 17, 2025)

1. **Update `lib/types/organization.ts`**
   - ✅ Changed `UserOrganization` interface to flat structure (matches backend)
   - ✅ Flat structure: `{organization_id, organization_name, organization_slug, role_id, role_name, role_slug, joined_at}`
   - **File:** `src/lib/types/organization.ts`

2. **Update `lib/api/organization-service.ts`**
   - ✅ Replaced placeholder auth with real Supabase session token
   - ✅ Fixed `getAuthHeaders()` to fetch JWT from `supabase.auth.getSession()`
   - ✅ All 10 API methods implemented (create, list, get, update, delete, members, invitations, roles, switch)
   - ✅ 397 lines of TypeScript code
   - ✅ Utility methods: `generateSlug()`, role formatters, validators
   - **File:** `src/lib/api/organization-service.ts`

---

### ✅ Phase 2: Create Organization
**Status:** ✅ Complete (October 17, 2025)

3. **Create `/app/organizations/create/page.tsx`**
   - ✅ Russian title: "Создать организацию"
   - ✅ Form fields implemented:
     - Name (required): "Название организации"
     - Slug (auto-generated, editable): "Уникальный идентификатор"
     - Description (optional): "Описание"
   - ✅ Auto-generate slug from name (transliteration + kebab-case)
   - ✅ Validation:
     - Name: required, 3-100 characters
     - Slug: required, unique, lowercase, alphanumeric + hyphens
     - Description: optional, max 500 characters
   - ✅ Success: Shows success message
   - ✅ Error handling: Displays validation errors
   - ⏳ **Test:** Create organization flow (needs testing with Playwright)
   - **File:** `src/app/organizations/create/page.tsx`

**Additional Pages Created (Bonus):**
- ✅ `/app/auth/register/page.tsx` - User registration with Russian UI
- ✅ `/app/onboarding/page.tsx` - Welcome page directing to org creation

**Components created:**
- `/app/organizations/create/page.tsx` - ✅ Complete
- `/components/organizations/OrganizationSwitcher.tsx` - ✅ Created (needs integration)

---

### Phase 3: Organization List & Settings
**Status:** ⏳ Pending (After Testing Complete)

4. **Create `/app/organizations/page.tsx`**
   - Russian title: "Мои организации"
   - Display organizations as cards (Ant Design Card component)
   - Each card shows:
     - Organization name (title)
     - Organization slug (subtitle)
     - Role badge: "Владелец" (Owner), "Администратор" (Admin), "Участник" (Member)
     - Description (truncated to 100 chars)
     - Actions: "Открыть" (View), "Настройки" (Settings, owner/admin only)
   - "Создать организацию" button (primary, top right)
   - Empty state: "У вас пока нет организаций. Создайте первую!"
   - **Test:** View all organizations, verify roles display correctly

5. **Create `/app/organizations/[id]/page.tsx`**
   - Russian title: "Настройки организации"
   - Breadcrumb: Организации → [Org Name] → Настройки
   - View mode (all users):
     - Display org name, slug, description, creation date
     - Member count, owner name
   - Edit mode (owner/admin only):
     - Editable fields: name, description
     - Slug is read-only (or warning: "Изменение идентификатора может сломать ссылки")
     - Save button: "Сохранить изменения"
     - Cancel button: "Отменить"
   - Danger zone (owner only):
     - "Удалить организацию" button (destructive)
     - Confirmation modal: "Вы уверены? Это действие нельзя отменить."
     - Soft delete (status = 'deleted')
   - **Test:** Edit organization name, verify changes saved. Delete organization, verify soft delete.

**Components to create:**
- `/app/organizations/page.tsx`
- `/app/organizations/[id]/page.tsx`
- `/components/organizations/OrganizationCard.tsx`
- `/components/organizations/EditOrgForm.tsx` (optional)

---

### Phase 4: Organization Switcher
**Status:** 🚧 Partially Complete (Component created, needs integration)

6. **Create `components/organizations/OrganizationSwitcher.tsx`**
   - Dropdown component (Ant Design Dropdown + Button)
   - Trigger: Current organization name + down arrow icon
   - If no current org: "Выберите организацию"
   - Dropdown menu shows:
     - List of all user's organizations
     - Current org has checkmark icon
     - Click to switch organization
     - Divider
     - "Все организации" link → `/organizations`
   - On switch:
     - Call API: `POST /api/organizations/{id}/switch`
     - Update local state/context
     - Show success message: "Переключено на [Org Name]"
     - Refresh page data
   - **Test:** Switch between organizations, verify current org updates

7. **Update `components/layout/MainLayout.tsx`**
   - Add OrganizationSwitcher to header (between logo and user avatar)
   - Add "Организации" menu item to sidebar:
     - Icon: `ApartmentOutlined` or `BankOutlined`
     - Label: "Организации"
     - Link: `/organizations`
   - **Test:** Verify switcher appears in header, menu item clickable

**Components to create:**
- `/components/organizations/OrganizationSwitcher.tsx`

**Components to modify:**
- `/components/layout/MainLayout.tsx`

---

### Phase 5: Team Management
**Status:** ⏳ Pending (After Testing Complete)

8. **Create `/app/organizations/[id]/team/page.tsx`**
   - Access control: Owners/Admins only (redirect others with error)
   - Russian title: "Команда организации"
   - Breadcrumb: Организации → [Org Name] → Команда
   - Members table (Ant Design Table):
     - Columns:
       - Name/Email (user_full_name + user_email)
       - Role (роль): Dropdown to change role (admin only)
       - Status (статус): Badge (Активен/Приглашён)
       - Joined Date (дата присоединения)
       - Actions (действия): Remove button (admin only, can't remove owner)
     - Pagination: 10 per page
   - "Пригласить участника" button (primary, top right)
   - Invite modal:
     - Email input: "Email адрес"
     - Role select: "Роль" (dropdown with 5 system roles)
     - Message textarea: "Сообщение приглашения" (optional)
     - Buttons: "Отправить приглашение" (primary), "Отменить" (default)
   - **Test:** List members, change member role, remove member, invite new member

9. **Create `/app/organizations/[id]/invitations/page.tsx`**
   - Access control: Owners/Admins only
   - Russian title: "Приглашения"
   - Breadcrumb: Организации → [Org Name] → Приглашения
   - Invitations table (Ant Design Table):
     - Columns:
       - Email
       - Role (роль)
       - Status (статус): Badge (Ожидает/Принято/Отменено/Истёк)
       - Created (создано): Date
       - Expires (истекает): Date
       - Actions: Cancel button (pending only)
     - Pagination: 10 per page
   - Filter tabs: Все / Ожидают / Принятые / Отменённые
   - **Test:** List invitations, cancel invitation, verify status changes

**Components to create:**
- `/app/organizations/[id]/team/page.tsx`
- `/app/organizations/[id]/invitations/page.tsx`
- `/components/organizations/MemberList.tsx`
- `/components/organizations/InviteMemberModal.tsx`
- `/components/organizations/InvitationList.tsx`

---

## File Structure

```
frontend/
├── ORGANIZATION_UI_PLAN.md                    # This plan
├── src/
│   ├── app/
│   │   └── organizations/
│   │       ├── page.tsx                       # List (Phase 3)
│   │       ├── create/
│   │       │   └── page.tsx                   # Create (Phase 2)
│   │       └── [id]/
│   │           ├── page.tsx                   # Settings (Phase 3)
│   │           ├── team/
│   │           │   └── page.tsx               # Team (Phase 5)
│   │           └── invitations/
│   │               └── page.tsx               # Invitations (Phase 5)
│   ├── components/
│   │   └── organizations/
│   │       ├── OrganizationSwitcher.tsx       # Switcher (Phase 4)
│   │       ├── OrganizationCard.tsx           # Card component
│   │       ├── CreateOrgForm.tsx              # Create form (optional)
│   │       ├── EditOrgForm.tsx                # Edit form (optional)
│   │       ├── MemberList.tsx                 # Members table
│   │       ├── InviteMemberModal.tsx          # Invite dialog
│   │       └── InvitationList.tsx             # Invitations table
│   └── lib/
│       ├── api/
│       │   └── organization-service.ts        # FIX (Phase 1)
│       └── types/
│           └── organization.ts                # FIX (Phase 1)
```

---

## Russian Labels Dictionary

| English | Russian |
|---------|---------|
| Organization | Организация |
| Create Organization | Создать организацию |
| My Organizations | Мои организации |
| Team | Команда |
| Settings | Настройки |
| Members | Участники |
| Invite | Пригласить |
| Invitations | Приглашения |
| Owner | Владелец |
| Admin | Администратор |
| Member | Участник |
| Delete | Удалить |
| Edit | Редактировать |
| Save | Сохранить |
| Cancel | Отменить |
| Name | Название |
| Description | Описание |
| Identifier | Идентификатор |
| Email | Email |
| Role | Роль |
| Status | Статус |
| Active | Активен |
| Invited | Приглашён |
| Pending | Ожидает |
| Accepted | Принято |
| Cancelled | Отменено |
| Expired | Истёк |
| Created | Создано |
| Expires | Истекает |
| Actions | Действия |
| Remove | Удалить |
| Send Invitation | Отправить приглашение |
| Invite Member | Пригласить участника |
| Change Role | Изменить роль |
| Message | Сообщение |
| All | Все |
| View | Открыть |
| Joined | Присоединился |
| You don't have any organizations yet. Create your first! | У вас пока нет организаций. Создайте первую! |

---

## Testing Checklist

### After Phase 1 (Foundation) ✅ READY FOR TESTING
- [ ] API calls work with Supabase JWT token (needs testing)
- [ ] Can fetch user's organizations from backend (needs testing)
- [x] Types match backend response structure (verified in code)

### After Phase 2 (Create) ✅ READY FOR TESTING
**Current Status:** Built but not tested with Playwright
- [ ] Can create organization with valid data (needs testing)
- [ ] Slug auto-generates from name (needs testing)
- [ ] Validation works (required fields, unique slug) (needs testing)
- [ ] Success message displays (needs testing)
- [ ] New organization appears in database (needs testing)

**Playwright Test Script:** 🚧 TO BE CREATED
- Script location: `frontend/test-organization-create.js`
- Test: Login → Navigate to create page → Fill form → Submit → Verify success

### After Phase 3 (List & Settings)
- [ ] Organization list displays all user's organizations
- [ ] Role badges show correct values (Owner/Admin/Member)
- [ ] Can navigate to organization settings
- [ ] Can edit organization (owner/admin only)
- [ ] Changes save successfully
- [ ] Can delete organization (soft delete, owner only)
- [ ] Deleted organization no longer appears in list

### After Phase 4 (Switcher)
- [ ] Organization switcher appears in header
- [ ] Shows current organization name
- [ ] Dropdown lists all user's organizations
- [ ] Can switch between organizations
- [ ] Current org has checkmark
- [ ] "Организации" menu item works
- [ ] Page data refreshes after switch

### After Phase 5 (Team Management)
- [ ] Team page only accessible to owners/admins
- [ ] Members list displays correctly
- [ ] Can change member role (admin only)
- [ ] Can remove member (admin only, except owner)
- [ ] Can invite new member
- [ ] Invitation appears in invitations list
- [ ] Can cancel invitation
- [ ] Status updates correctly

---

## API Endpoints Used

All endpoints connect to backend at `http://localhost:8000/api`

### Organizations
- `GET /organizations/` - List user's organizations
- `POST /organizations/` - Create organization
- `GET /organizations/{id}` - Get organization details
- `PUT /organizations/{id}` - Update organization
- `DELETE /organizations/{id}` - Soft delete organization
- `POST /organizations/{id}/switch` - Switch current organization

### Members
- `GET /organizations/{id}/members` - List members

### Invitations
- `POST /organizations/{id}/invitations` - Create invitation
- `GET /organizations/{id}/invitations` - List invitations
- `DELETE /organizations/invitations/{id}` - Cancel invitation

### Roles
- `GET /organizations/{id}/roles` - List available roles

---

## Notes

- **Backend is 100% ready** - All endpoints tested and working
- **Use Ant Design components** - Consistent with existing UI
- **Incremental testing** - Test each phase before moving to next
- **Russian language** - All UI text in Russian
- **Owner/Admin access** - Team management restricted to owners/admins
- **Soft deletes** - Organizations marked as deleted, not removed
- **Toast notifications** - Use Ant Design `message` for success/error feedback
- **Loading states** - Show spinners during API calls
- **Error handling** - Display user-friendly error messages

---

**Plan saved:** October 17, 2025
**Implementation start:** October 17, 2025
**Target completion:** Current session

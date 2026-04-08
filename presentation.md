# InstaDemo

Built with Claude in one evening.
Demoed to fix the meetup that broke me.

---

# Demo nights have a queue problem

- Too many demos, no shared list
- "Who's next?" → awkward silence → 30 seconds of laptop shuffling
- Organizers can't gracefully cut the line or skip a no-show without it feeling rude

---

# How I built it

**Stack:** Node + Express + Socket.IO + QR codes, on Fly.io. Mobile-first. ~700 lines.

**The whole prompting arc, in 7 prompts:**

1. *"Make a plan, no executing, for a queue manager for live demo events"*
2. *"Let's implement"*
3. *"Cannot GET /admin"* — fix it
4. *"How do demoers submit again next week?"* — reframe the data model
5. *"Drag demoers instead of arrow keys"* — UX upgrade
6. *"Copy the QR code AND the URL"* — UX upgrade
7. *"Push to Fly.io"*

**The lesson:** plan first, then implement, then iterate on UX from real use. No one-shot. Each prompt is a small turn of the wheel.

---

# Let me show you

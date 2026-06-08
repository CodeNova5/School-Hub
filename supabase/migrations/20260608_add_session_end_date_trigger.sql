CREATE OR REPLACE FUNCTION update_session_end_date_from_terms()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE sessions
    SET end_date = (SELECT max(end_date) FROM terms WHERE session_id = OLD.session_id)
    WHERE id = OLD.session_id 
      AND EXISTS (SELECT 1 FROM terms WHERE session_id = OLD.session_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.session_id IS DISTINCT FROM NEW.session_id THEN
    -- Update old session
    UPDATE sessions
    SET end_date = (SELECT max(end_date) FROM terms WHERE session_id = OLD.session_id)
    WHERE id = OLD.session_id 
      AND EXISTS (SELECT 1 FROM terms WHERE session_id = OLD.session_id);
    
    -- Update new session
    UPDATE sessions
    SET end_date = (SELECT max(end_date) FROM terms WHERE session_id = NEW.session_id)
    WHERE id = NEW.session_id;
    RETURN NEW;
  ELSE
    -- INSERT or standard UPDATE
    UPDATE sessions
    SET end_date = (SELECT max(end_date) FROM terms WHERE session_id = NEW.session_id)
    WHERE id = NEW.session_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_session_end_date ON terms;
CREATE TRIGGER trg_update_session_end_date
AFTER INSERT OR UPDATE OF start_date, end_date, session_id OR DELETE ON terms
FOR EACH ROW EXECUTE FUNCTION update_session_end_date_from_terms();
